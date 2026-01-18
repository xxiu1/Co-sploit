/**
 * 对话框消息管理 Store
 * 管理对话框中的消息列表、操作计划展示等
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DialogMessage, ActionMessageData, ActionPlan } from '@/types'
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
    // Actions
    addMessage,
    addSystemMessage,
    addActionMessage,
    addUserMessage,
    addSuccessMessage,
    addErrorMessage,
    addWarningMessage,
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

