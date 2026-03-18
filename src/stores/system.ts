/**
 * 系统状态管理 Store
 * 管理系统的运行状态、目标IP、当前执行节点等
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SystemStatus, SystemState } from '@/types'
import { getSystemState, startFlow, pauseResumeFlow, stopFlow } from '@/api'
import { wsManager } from '@/utils/websocket'

export const useSystemStore = defineStore('system', () => {
  // ========== State ==========
  const status = ref<SystemStatus>('idle')
  const targetIP = ref<string>('')
  const currentExecutionNode = ref<string | undefined>(undefined)
  const error = ref<string | undefined>(undefined)

  // ========== Getters ==========
  const isRunning = computed(() => status.value === 'running')
  const isPaused = computed(() => status.value === 'paused')
  const isPausing = computed(() => status.value === 'pausing')
  const isCompleted = computed(() => status.value === 'completed')
  const isIdle = computed(() => status.value === 'idle')
  const isFailed = computed(() => status.value === 'failed')
  const hasError = computed(() => status.value === 'error' || status.value === 'failed' || error.value !== undefined)

  const systemState = computed<SystemState>(() => ({
    status: status.value,
    targetIP: targetIP.value,
    currentExecutionNode: currentExecutionNode.value,
    error: error.value,
  }))

  // ========== Actions ==========

  /**
   * 初始化 WebSocket 监听
   */
  function initWebSocket() {
    wsManager.on('system_status', (data: SystemState) => {
      updateSystemState(data)
    })

    wsManager.on('error', (data: { message: string }) => {
      setError(data.message)
    })
  }

  /**
   * 更新系统状态
   */
  function updateSystemState(state: SystemState) {
    status.value = state.status
    if (state.targetIP) targetIP.value = state.targetIP
    if (state.currentExecutionNode !== undefined) {
      currentExecutionNode.value = state.currentExecutionNode
    }
    if (state.error !== undefined) {
      error.value = state.error
    }
  }

  /**
   * 设置状态
   */
  function setStatus(newStatus: SystemStatus) {
    status.value = newStatus
    if (newStatus !== 'error') {
      error.value = undefined
    }
  }

  /**
   * 设置目标IP
   */
  function setTargetIP(ip: string) {
    targetIP.value = ip
  }

  /**
   * 设置当前执行节点
   */
  function setCurrentExecutionNode(nodeId: string | undefined) {
    currentExecutionNode.value = nodeId
  }

  /**
   * 设置错误
   */
  function setError(errorMessage: string | undefined) {
    error.value = errorMessage
    if (errorMessage) {
      status.value = 'error'
    }
  }

  /**
   * 启动流程
   */
  async function start(targetIPValue: string): Promise<void> {
    try {
      const state = await startFlow({ targetIP: targetIPValue })
      updateSystemState(state)
      setTargetIP(targetIPValue)
    } catch (err: any) {
      setError(err.message || '启动流程失败')
      throw err
    }
  }

  /**
   * 暂停流程
   */
  async function pause(): Promise<void> {
    try {
      const state = await pauseResumeFlow({ action: 'pause' })
      updateSystemState(state)
    } catch (err: any) {
      setError(err.message || '暂停流程失败')
      throw err
    }
  }

  /**
   * 继续流程
   */
  async function resume(): Promise<void> {
    try {
      const state = await pauseResumeFlow({ action: 'resume' })
      updateSystemState(state)
    } catch (err: any) {
      setError(err.message || '继续流程失败')
      throw err
    }
  }

  /**
   * 停止流程（终止执行并保存完整输出日志到后端 logs 目录）
   */
  async function stop(): Promise<void> {
    try {
      const state = await stopFlow()
      updateSystemState(state)
    } catch (err: any) {
      setError(err.message || '停止流程失败')
      throw err
    }
  }

  /**
   * 刷新系统状态
   */
  async function refreshState(): Promise<void> {
    try {
      const state = await getSystemState()
      updateSystemState(state)
    } catch (err: any) {
      console.error('刷新系统状态失败:', err)
    }
  }

  /**
   * 重置系统状态
   */
  function reset() {
    status.value = 'idle'
    targetIP.value = ''
    currentExecutionNode.value = undefined
    error.value = undefined
  }

  return {
    // State
    status,
    targetIP,
    currentExecutionNode,
    error,
    // Getters
    isRunning,
    isPaused,
    isPausing,
    isCompleted,
    isIdle,
    isFailed,
    hasError,
    systemState,
    // Actions
    initWebSocket,
    updateSystemState,
    setStatus,
    setTargetIP,
    setCurrentExecutionNode,
    setError,
    start,
    pause,
    resume,
    stop,
    refreshState,
    reset,
  }
})

