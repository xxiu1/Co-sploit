/**
 * Action Store
 * 管理 Action 状态，包括正在执行的 actions
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Action } from '@/types'
import { getActions, getExecutingActions } from '@/api'
import { wsManager } from '@/utils/websocket'

export const useActionStore = defineStore('action', () => {
  // State
  const actions = ref<Action[]>([])
  const executingActions = ref<Action[]>([])

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
      const response = await getExecutingActions()
      if (response.code === 200) {
        executingActions.value = response.data
        return response.data
      }
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

  function updateAction(action: Action) {
    const index = actions.value.findIndex(a => a.action_id === action.action_id)
    if (index >= 0) {
      actions.value[index] = action
    } else {
      actions.value.push(action)
    }

    // 更新 executingActions
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

  function removeAction(actionId: number) {
    actions.value = actions.value.filter(a => a.action_id !== actionId)
    executingActions.value = executingActions.value.filter(a => a.action_id !== actionId)
  }

  // 初始化 WebSocket 监听
  function initWebSocketListeners() {
    // 监听 action_created 消息
    wsManager.on('action_created', (data: Action) => {
      addAction(data)
    })

    // 监听 action_updated 消息
    wsManager.on('action_updated', (data: Action) => {
      updateAction(data)
    })

    // 监听 action_completed 消息（result 不再是 unknown）
    wsManager.on('action_completed', (data: Action) => {
      updateAction(data)
    })
  }

  // 清理 WebSocket 监听
  function cleanupWebSocketListeners() {
    wsManager.off('action_created', addAction)
    wsManager.off('action_updated', updateAction)
    wsManager.off('action_completed', updateAction)
  }

  return {
    // State
    actions,
    executingActions,
    // Getters
    getActionsByTaskId,
    getExecutingActionsByTaskId,
    // Actions
    fetchActions,
    fetchExecutingActions,
    addAction,
    updateAction,
    removeAction,
    initWebSocketListeners,
    cleanupWebSocketListeners,
  }
})
