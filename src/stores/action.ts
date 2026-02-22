/**
 * Action Store
 * 管理 Action 状态，包括正在执行的 actions
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Action } from '@/types'
import { getActions, getExecutingActions } from '@/api'
import { wsManager } from '@/utils/websocket'
import { useDialogStore } from './dialog'

/** 由后端 stdout 解析推送的「实时执行中」条目（Shell 已开始、尚未写入 DB） */
export interface LiveExecutingItem {
  task_id: number
  command: string
  risk_score?: number
  estimated_time?: string
  risk_brief?: string
}

export const useActionStore = defineStore('action', () => {
  // State
  const actions = ref<Action[]>([])
  const executingActions = ref<Action[]>([])
  /** 方案 A：由 action_started/action_ended 更新的实时执行条目，便于「正在执行的操作」立即展示 */
  const liveExecuting = ref<LiveExecutingItem[]>([])

  // Getters
  const getActionsByTaskId = computed(() => {
    return (taskId: number) => {
      return actions.value.filter(action => action.parent_node === taskId)
    }
  })

  const getExecutingActionsByTaskId = computed(() => {
    return (taskId: number) => {
      return executingActions.value.filter(action => action.parent_node === taskId)
    }
  })

  // Actions
  async function fetchActions(params?: { task_id?: number; status?: string; limit?: number }) {
    try {
      const response = await getActions(params)
      if (response.code === 200) {
        actions.value = response.data
        return response.data
      }
    } catch (error) {
      console.error('Failed to fetch actions:', error)
    }
    return []
  }

  async function fetchExecutingActions() {
    try {
      // 请求拦截器在 200 时返回 res.data，即后端返回的 data 数组
      const response = await getExecutingActions()
      const list = Array.isArray(response) ? response : (response && (response as any).data) ?? []
      executingActions.value = Array.isArray(list) ? list : []
      return executingActions.value
    } catch (error) {
      console.error('Failed to fetch executing actions:', error)
    }
    return []
  }

  function addAction(action: Action) {
    // 检查是否已存在
    const existingIndex = actions.value.findIndex(a => a.action_id === action.action_id)
    if (existingIndex >= 0) {
      actions.value[existingIndex] = action
    } else {
      actions.value.push(action)
    }

    // 如果是正在执行的，更新 executingActions
    if (action.result === 'unknown' || !action.result) {
      const execIndex = executingActions.value.findIndex(a => a.action_id === action.action_id)
      if (execIndex >= 0) {
        executingActions.value[execIndex] = action
      } else {
        executingActions.value.push(action)
      }
    } else {
      // 如果已完成，从 executingActions 中移除
      executingActions.value = executingActions.value.filter(a => a.action_id !== action.action_id)
    }
  }

  function updateAction(action: Action | Partial<Action> & { action_id: number }) {
    const id = action.action_id
    const index = actions.value.findIndex(a => a.action_id === id)
    if (index >= 0) {
      actions.value[index] = { ...actions.value[index], ...action }
    } else if (id != null) {
      actions.value.push(action as Action)
    }

    // 更新 executingActions（合并局部更新，如 risk_brief / estimated_time）
    if (action.result === 'unknown' || action.result == null || action.result === undefined) {
      const execIndex = executingActions.value.findIndex(a => a.action_id === id)
      if (execIndex >= 0) {
        executingActions.value[execIndex] = { ...executingActions.value[execIndex], ...action }
      } else if (id != null) {
        executingActions.value.push(action as Action)
      }
    } else {
      // 如果已完成，从 executingActions 中移除
      executingActions.value = executingActions.value.filter(a => a.action_id !== id)
    }
  }

  function removeAction(actionId: number) {
    actions.value = actions.value.filter(a => a.action_id !== actionId)
    executingActions.value = executingActions.value.filter(a => a.action_id !== actionId)
  }

  /** 清空“正在执行”列表（例如本次运行开始时，避免展示上一轮过期数据） */
  function clearExecutingActions() {
    executingActions.value = []
    liveExecuting.value = []
  }

  function onActionStarted(data: {
    task_id: number
    command?: string
    action_id?: number
    risk_score?: number
    estimated_time?: string
    risk_brief?: string
    started_at?: string
  }) {
    liveExecuting.value = liveExecuting.value.filter((x) => x.task_id !== data.task_id)
    liveExecuting.value.push({
      task_id: data.task_id,
      command: data.command ?? '',
      risk_score: data.risk_score,
      estimated_time: data.estimated_time,
      risk_brief: data.risk_brief,
    })
    if (data.action_id != null && data.task_id != null) {
      try {
        const dialogStore = useDialogStore()
        dialogStore.addActionExecutionMessage({
          action_id: data.action_id,
          task_id: data.task_id,
          command: data.command ?? '',
          risk_score: data.risk_score,
          estimated_time: data.estimated_time,
          started_at: data.started_at,
          status: 'executing',
        })
      } catch (_) {
        // dialog store 可能尚未挂载
      }
    }
  }

  function onActionEnded(data: {
    task_id?: number
    command?: string
    action_id?: number
    status?: string
    exitcode?: number | null
    finished_at?: string
  }) {
    if (data.command != null && data.command !== '') {
      liveExecuting.value = liveExecuting.value.filter((x) => x.command !== data.command)
    } else if (data.task_id != null) {
      liveExecuting.value = liveExecuting.value.filter((x) => x.task_id !== data.task_id)
    }
    if (data.action_id != null) {
      const result = data.status === 'success' ? 'success' : 'failed'
      updateAction({
        action_id: data.action_id,
        result,
        finished_at: data.finished_at,
      })
      try {
        const dialogStore = useDialogStore()
        const success = data.status === 'success'
        dialogStore.updateActionExecutionMessage(data.action_id, {
          status: success ? 'success' : 'failed',
          result: success
            ? { success: true, message: '执行成功' }
            : { success: false },
          finished_at: data.finished_at,
        })
      } catch (_) { }
    } else if (data.task_id != null) {
      // 后备路径只带 task_id：从「正在执行」中移除该 task 下所有 action，并更新对话框卡片
      executingActions.value = executingActions.value.filter(
        (a) => a.parent_node !== data.task_id
      )
      try {
        const dialogStore = useDialogStore()
        const success = data.status !== 'failed'
        dialogStore.updateActionExecutionMessagesByTaskId(data.task_id!, {
          status: success ? 'success' : 'failed',
          result: success
            ? { success: true, message: '执行成功' }
            : { success: false },
          finished_at: data.finished_at,
        })
      } catch (_) { }
    }
  }

  /** 事后绑定：将已推送的实时条目按 command 归属到正确 task_id */
  function onActionTaskBound(data: { task_id: number; command: string }) {
    const cmd = (data.command || '').trim()
    if (!cmd) return
    let idx = -1
    for (let i = liveExecuting.value.length - 1; i >= 0; i--) {
      const c = (liveExecuting.value[i].command || '').trim()
      if (c === cmd || c.includes(cmd) || cmd.includes(c)) {
        idx = i
        break
      }
    }
    if (idx >= 0) {
      liveExecuting.value = liveExecuting.value.map((x, i) =>
        i === idx ? { ...x, task_id: data.task_id } : x
      )
    }
  }

  // 初始化 WebSocket 监听
  function initWebSocketListeners() {
    wsManager.on('action_created', (data: Action) => {
      addAction(data)
    })
    wsManager.on('action_updated', (data: Action & { risk_brief?: string; estimated_time?: string; analyze_context?: string }) => {
      updateAction(data)
      try {
        if (data.action_id == null) return
        // 只合并 payload 中存在的字段，避免后续 ENDED/OUTPUT/结果分析 推送无 risk_brief/estimated_time 时用 undefined 覆盖已有值
        const updates: Partial<{ risk_brief: string; estimated_time: string; risk_score: number; analyze_context: string }> = {}
        if (data.risk_brief !== undefined) updates.risk_brief = data.risk_brief
        if (data.estimated_time !== undefined) updates.estimated_time = data.estimated_time
        if (data.risk_score !== undefined && data.risk_score !== null) updates.risk_score = data.risk_score
        if (data.analyze_context !== undefined) updates.analyze_context = data.analyze_context
        useDialogStore().updateActionExecutionMessage(data.action_id, updates)
      } catch (_) { }
    })
    wsManager.on('action_completed', (data: Action) => {
      updateAction(data)
    })
    wsManager.on('action_started', onActionStarted)
    wsManager.on('action_ended', onActionEnded)
    wsManager.on('action_task_bound', onActionTaskBound)
  }

  // 清理 WebSocket 监听
  function cleanupWebSocketListeners() {
    wsManager.off('action_started', onActionStarted)
    wsManager.off('action_ended', onActionEnded)
    wsManager.off('action_task_bound', onActionTaskBound)
    // 注意：下面三处若原本用匿名函数注册，off 可能无法移除，建议后续改为具名回调再 off
    wsManager.off('action_created', addAction)
    wsManager.off('action_updated', updateAction)
    wsManager.off('action_completed', updateAction)
  }

  return {
    // State
    actions,
    executingActions,
    liveExecuting,
    // Getters
    getActionsByTaskId,
    getExecutingActionsByTaskId,
    // Actions
    fetchActions,
    fetchExecutingActions,
    addAction,
    updateAction,
    removeAction,
    clearExecutingActions,
    initWebSocketListeners,
    cleanupWebSocketListeners,
  }
})
