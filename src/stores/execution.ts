/**
 * 执行管理 Store
 * 管理执行队列、执行历史等
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ExecutionQueueItem, ExecutionResult, ActionPlan } from '@/types'
import { getExecutionHistory, executeAction } from '@/api'
import { wsManager } from '@/utils/websocket'

export interface ExecutionHistoryItem {
  id: string
  nodeId: string
  nodeType: string
  actionPlan: ActionPlan
  result?: ExecutionResult
  timestamp: string
  status: 'pending' | 'executing' | 'success' | 'failed'
}

export const useExecutionStore = defineStore('execution', () => {
  // ========== State ==========
  const queue = ref<ExecutionQueueItem[]>([])
  const history = ref<ExecutionHistoryItem[]>([])
  const currentExecution = ref<ExecutionHistoryItem | null>(null)

  // ========== Getters ==========
  const queueLength = computed(() => queue.value.length)

  const pendingQueue = computed(() => {
    return queue.value.filter((item) => {
      const historyItem = history.value.find((h) => h.nodeId === item.nodeId)
      return !historyItem || historyItem.status === 'pending'
    })
  })

  const sortedHistory = computed(() => {
    return [...history.value].sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
  })

  const successHistory = computed(() => {
    return history.value.filter((item) => item.status === 'success')
  })

  const failedHistory = computed(() => {
    return history.value.filter((item) => item.status === 'failed')
  })

  const getHistoryByNodeId = computed(() => (nodeId: string) => {
    return history.value.filter((item) => item.nodeId === nodeId)
  })

  // ========== Actions ==========

  /**
   * 初始化 WebSocket 监听
   */
  function initWebSocket() {
    wsManager.on('execution_result', (data: { nodeId: string; result: ExecutionResult }) => {
      updateExecutionResult(data.nodeId, data.result)
    })
  }

  /**
   * 设置执行队列
   */
  function setQueue(newQueue: ExecutionQueueItem[]) {
    queue.value = newQueue
  }

  /**
   * 添加执行项到队列
   */
  function addToQueue(item: ExecutionQueueItem) {
    const exists = queue.value.some((q) => q.nodeId === item.nodeId)
    if (!exists) {
      queue.value.push(item)
      // 按优先级排序
      queue.value.sort((a, b) => b.priority - a.priority)
    }
  }

  /**
   * 从队列中移除执行项
   */
  function removeFromQueue(nodeId: string) {
    const index = queue.value.findIndex((item) => item.nodeId === nodeId)
    if (index >= 0) {
      queue.value.splice(index, 1)
    }
  }

  /**
   * 清空队列
   */
  function clearQueue() {
    queue.value = []
  }

  /**
   * 设置执行历史
   */
  function setHistory(newHistory: ExecutionHistoryItem[]) {
    history.value = newHistory
  }

  /**
   * 添加执行历史
   */
  function addHistory(item: ExecutionHistoryItem) {
    const existingIndex = history.value.findIndex((h) => h.id === item.id)
    if (existingIndex >= 0) {
      history.value[existingIndex] = item
    } else {
      history.value.push(item)
    }
  }

  /**
   * 更新执行结果
   */
  function updateExecutionResult(nodeId: string, result: ExecutionResult) {
    const historyItem = history.value.find((h) => h.nodeId === nodeId)
    if (historyItem) {
      historyItem.result = result
      historyItem.status = result.success ? 'success' : 'failed'
    }
  }

  /**
   * 设置当前执行项
   */
  function setCurrentExecution(item: ExecutionHistoryItem | null) {
    currentExecution.value = item
  }

  /**
   * 开始执行
   */
  function startExecution(item: ExecutionHistoryItem) {
    setCurrentExecution(item)
    const existingIndex = history.value.findIndex((h) => h.id === item.id)
    if (existingIndex >= 0) {
      history.value[existingIndex].status = 'executing'
    } else {
      history.value.push({ ...item, status: 'executing' })
    }
  }

  /**
   * 完成执行
   */
  function completeExecution(nodeId: string, result: ExecutionResult) {
    const historyItem = history.value.find((h) => h.nodeId === nodeId)
    if (historyItem) {
      historyItem.result = result
      historyItem.status = result.success ? 'success' : 'failed'
    }
    if (currentExecution.value?.nodeId === nodeId) {
      currentExecution.value = null
    }
    removeFromQueue(nodeId)
  }

  /**
   * 执行操作
   */
  async function execute(
    nodeType: string,
    actionPlanId: string,
    modifiedCmd?: string
  ): Promise<ExecutionResult> {
    try {
      const result = await executeAction({
        nodeType,
        actionPlanId,
        modifiedCmd,
      })
      return result
    } catch (err: any) {
      console.error('执行操作失败:', err)
      throw err
    }
  }

  /**
   * 从服务器加载执行历史
   */
  async function loadHistory(): Promise<void> {
    try {
      const historyList = await getExecutionHistory()
      setHistory(historyList as ExecutionHistoryItem[])
    } catch (err: any) {
      // 如果后端端点不存在，只记录警告，不抛出错误
      console.warn('加载执行历史失败（可能后端未实现）:', err.message || err)
      // 不抛出错误，允许继续执行
      setHistory([])
    }
  }

  /**
   * 重置执行数据
   */
  function reset() {
    queue.value = []
    history.value = []
    currentExecution.value = null
  }

  return {
    // State
    queue,
    history,
    currentExecution,
    // Getters
    queueLength,
    pendingQueue,
    sortedHistory,
    successHistory,
    failedHistory,
    getHistoryByNodeId,
    // Actions
    initWebSocket,
    setQueue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    setHistory,
    addHistory,
    updateExecutionResult,
    setCurrentExecution,
    startExecution,
    completeExecution,
    execute,
    loadHistory,
    reset,
  }
})

