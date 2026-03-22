/**
 * 对话框消息管理 Store
 * 管理对话框中的消息列表、操作计划展示等
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  DialogMessage,
  ActionMessageData,
  ActionExecutionMessageData,
  ActionPlan,
  InterventionMessageData,
} from '@/types'
import { generateId, formatTimestamp } from '@/utils'

export const useDialogStore = defineStore('dialog', () => {
  // ========== State ==========
  const messages = ref<DialogMessage[]>([])
  const isVisible = ref<boolean>(false)
  const autoScroll = ref<boolean>(true)

  // ========== Getters ==========
  const messageCount = computed(() => messages.value.length)

  const systemMessages = computed(() => {
    return messages.value.filter((msg) => msg.type === 'system')
  })

  const actionMessages = computed(() => {
    return messages.value.filter((msg) => msg.type === 'action')
  })

  const userMessages = computed(() => {
    return messages.value.filter((msg) => msg.type === 'user')
  })

  const latestMessage = computed(() => {
    return messages.value.length > 0 ? messages.value[messages.value.length - 1] : null
  })

  const unreadCount = computed(() => {
    // 可以根据需要实现未读消息计数逻辑
    return 0
  })

  /** True if any intervention card is still awaiting submit (unified pause→submit→resume path). */
  const hasPendingIntervention = computed(() =>
    messages.value.some(
      (m) =>
        m.type === 'intervention' &&
        m.interventionData &&
        m.interventionData.status !== 'submitted'
    )
  )

  // ========== Actions ==========

  /**
   * 添加消息
   */
  function addMessage(message: Omit<DialogMessage, 'id' | 'timestamp'>) {
    const newMessage: DialogMessage = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      ...message,
    }
    messages.value.push(newMessage)
    return newMessage
  }

  /**
   * 添加系统消息
   */
  function addSystemMessage(content: string) {
    return addMessage({
      type: 'system',
      content,
    })
  }

  /**
   * 添加操作消息
   */
  function addActionMessage(actionData: ActionMessageData) {
    return addMessage({
      type: 'action',
      actionData,
    })
  }

  /**
   * 添加实时执行 action 卡片（来自 action_started），执行完不删除、作为历史展示
   */
  function addActionExecutionMessage(data: Omit<ActionExecutionMessageData, 'status'> & { status?: ActionExecutionMessageData['status'] }) {
    const existing = messages.value.find(
      (m) => m.type === 'action_execution' && m.actionExecutionData?.action_id === data.action_id
    )
    if (existing && existing.actionExecutionData) {
      Object.assign(existing.actionExecutionData, { ...data, status: data.status ?? 'executing' })
      return existing
    }
    const payload: ActionExecutionMessageData = {
      ...data,
      status: data.status ?? 'executing',
    }
    return addMessage({
      type: 'action_execution',
      actionExecutionData: payload,
    })
  }

  /**
   * 更新实时执行 action 卡片（来自 action_ended/action_updated）
   */
  function updateActionExecutionMessage(action_id: number, updates: Partial<ActionExecutionMessageData>) {
    const msg = messages.value.find(
      (m) => m.type === 'action_execution' && m.actionExecutionData?.action_id === action_id
    )
    if (msg?.actionExecutionData) {
      Object.assign(msg.actionExecutionData, updates)
    }
  }

  /**
   * 按 task_id 批量更新实时执行卡片（用于后备路径只带 task_id 的 action_ended）
   */
  function updateActionExecutionMessagesByTaskId(
    taskId: number,
    updates: Partial<ActionExecutionMessageData>
  ) {
    messages.value
      .filter(
        (m) => m.type === 'action_execution' && m.actionExecutionData?.task_id === taskId
      )
      .forEach((m) => {
        if (m.actionExecutionData) Object.assign(m.actionExecutionData, updates)
      })
  }

  /**
   * 添加用户消息
   */
  function addUserMessage(content: string) {
    return addMessage({
      type: 'user',
      content,
    })
  }

  /**
   * 添加成功消息
   */
  function addSuccessMessage(content: string) {
    return addMessage({
      type: 'success',
      content,
    })
  }

  /**
   * 添加错误消息
   */
  function addErrorMessage(content: string) {
    return addMessage({
      type: 'error',
      content,
    })
  }

  /**
   * 添加警告消息
   */
  function addWarningMessage(content: string) {
    return addMessage({
      type: 'warning',
      content,
    })
  }

  /**
   * Human intervention card (Cross-Modal, etc.) — payload from WebSocket intervention_request
   */
  function addInterventionMessage(payload: Record<string, unknown>) {
    const iid = String(payload.intervention_id ?? '')
    if (!iid) return null
    if (
      messages.value.some(
        (m) => m.type === 'intervention' && m.interventionData?.intervention_id === iid
      )
    ) {
      return null
    }
    const md = payload.metadata
    const data: InterventionMessageData = {
      intervention_id: iid,
      intervention_type: String(payload.intervention_type ?? ''),
      target_node_id: Number(payload.target_node_id) || 0,
      current_goal: String(payload.current_goal ?? ''),
      why_blocked: String(payload.why_blocked ?? ''),
      required_action: String(payload.required_action ?? ''),
      target_interface_context: String(payload.target_interface_context ?? ''),
      expected_return_format: String(payload.expected_return_format ?? ''),
      status: (payload.status as InterventionMessageData['status']) || 'pending',
      metadata: md && typeof md === 'object' && !Array.isArray(md) ? { ...(md as Record<string, unknown>) } : undefined,
    }
    return addMessage({
      type: 'intervention',
      interventionData: data,
    })
  }

  function setInterventionSubmitted(interventionId: string, userResponse?: string) {
    const msg = messages.value.find(
      (m) => m.type === 'intervention' && m.interventionData?.intervention_id === interventionId
    )
    if (msg?.interventionData) {
      msg.interventionData.status = 'submitted'
      if (userResponse !== undefined) {
        msg.interventionData.user_input = userResponse
      }
    }
  }

  /**
   * 更新操作消息状态
   */
  function updateActionMessageStatus(messageId: string, status: ActionMessageData['status']) {
    const message = messages.value.find((msg) => msg.id === messageId)
    if (message && message.actionData) {
      message.actionData.status = status
    }
  }

  /**
   * 更新操作消息结果
   */
  function updateActionMessageResult(messageId: string, result: ActionMessageData['result']) {
    const message = messages.value.find((msg) => msg.id === messageId)
    if (message && message.actionData) {
      message.actionData.result = result
      message.actionData.status = result?.success ? 'success' : 'failed'
    }
  }

  /**
   * 删除消息
   */
  function removeMessage(messageId: string) {
    const index = messages.value.findIndex((msg) => msg.id === messageId)
    if (index >= 0) {
      messages.value.splice(index, 1)
    }
  }

  /**
   * 清空消息
   */
  function clearMessages() {
    messages.value = []
  }

  /**
   * 显示对话框
   */
  function show() {
    isVisible.value = true
  }

  /**
   * 隐藏对话框
   */
  function hide() {
    isVisible.value = false
  }

  /**
   * 切换对话框显示状态
   */
  function toggle() {
    isVisible.value = !isVisible.value
  }

  /**
   * 设置自动滚动
   */
  function setAutoScroll(enabled: boolean) {
    autoScroll.value = enabled
  }

  /**
   * 获取格式化的时间戳
   */
  function getFormattedTimestamp(messageId: string): string {
    const message = messages.value.find((msg) => msg.id === messageId)
    if (message) {
      return formatTimestamp(message.timestamp)
    }
    return ''
  }

  /**
   * 重置对话框数据
   */
  function reset() {
    messages.value = []
    isVisible.value = false
    autoScroll.value = true
  }

  return {
    // State
    messages,
    isVisible,
    autoScroll,
    // Getters
    messageCount,
    systemMessages,
    actionMessages,
    userMessages,
    latestMessage,
    unreadCount,
    hasPendingIntervention,
    // Actions
    addMessage,
    addSystemMessage,
    addActionMessage,
    addActionExecutionMessage,
    updateActionExecutionMessage,
    updateActionExecutionMessagesByTaskId,
    addUserMessage,
    addSuccessMessage,
    addErrorMessage,
    addWarningMessage,
    addInterventionMessage,
    setInterventionSubmitted,
    updateActionMessageStatus,
    updateActionMessageResult,
    removeMessage,
    clearMessages,
    show,
    hide,
    toggle,
    setAutoScroll,
    getFormattedTimestamp,
    reset,
  }
})

