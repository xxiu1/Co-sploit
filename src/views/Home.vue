<template>
  <div class="home-container w-full h-full bg-dark-bg flex flex-col overflow-hidden">
    <!-- 头部 -->
    <header
      class="h-14 border-b border-dark-border bg-[#0f1119] flex items-center justify-between px-6 z-50 shrink-0"
    >
      <div class="flex items-center gap-3">
        <div class="text-purple-500 font-bold tracking-wider">
          CO-SPLOIT <span class="text-xs text-gray-500">FULL FLOW</span>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <div class="text-xs text-gray-500 font-mono">
          MISSION:
          <span
            class="ml-1"
            :class="{
              'text-yellow-500': systemStore.isRunning,
              'text-blue-500': systemStore.isPaused,
              'text-green-500': systemStore.isCompleted,
              'text-red-500': systemStore.hasError,
              'text-gray-500': systemStore.isIdle,
            }"
          >
            {{ missionStatusText }}
          </span>
        </div>
        <button
          v-if="systemStore.isRunning || systemStore.isPaused"
          @click="handlePauseResume"
          class="text-xs bg-yellow-900 hover:bg-yellow-800 px-3 py-1.5 rounded text-yellow-300 transition-colors flex items-center gap-1.5"
        >
          <i :class="systemStore.isPaused ? 'fas fa-play' : 'fas fa-pause'"></i>
          <span>{{ systemStore.isPaused ? '继续' : '暂停' }}</span>
        </button>
      </div>
    </header>

    <!-- 主内容区域 -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- 左侧：画布 -->
      <main class="flex-1 relative bg-dark-bg overflow-hidden">
        <CanvasView />
        <StartOverlay :show="showStartOverlay" @start="handleStartFlow" />
      </main>

      <!-- 右侧：对话框 -->
      <DialogPanel />
    </div>

    <!-- 底部：终端 -->
    <TerminalPanel ref="terminalRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { CanvasView } from '@/components/Canvas'
import { DialogPanel } from '@/components/Dialog'
import { TerminalPanel } from '@/components/Terminal'
import StartOverlay from '@/components/Common/StartOverlay.vue'
import {
  useSystemStore,
  useNodeStore,
  useClueStore,
  useExecutionStore,
  useDialogStore,
} from '@/stores'
import { wsManager } from '@/utils/websocket'
import type { Node, Clue, WSMessage } from '@/types'

const systemStore = useSystemStore()
const nodeStore = useNodeStore()
const clueStore = useClueStore()
const executionStore = useExecutionStore()
const dialogStore = useDialogStore()

const showStartOverlay = computed(() => systemStore.isIdle)
const terminalRef = ref<InstanceType<typeof TerminalPanel>>()

const missionStatusText = computed(() => {
  if (systemStore.isRunning) return 'IN PROGRESS'
  if (systemStore.isPaused) return 'PAUSED'
  if (systemStore.isCompleted) return 'COMPLETED'
  if (systemStore.hasError) return 'ERROR'
  return 'READY'
})

// 启动流程
async function handleStartFlow(targetIP: string) {
  try {
    // 1. 添加系统消息
    dialogStore.addSystemMessage('🚀 正在启动自动化渗透测试流程...')
    terminalRef.value?.writeCommand(`Starting automated penetration test for target: ${targetIP}`)

    // 2. 初始化 WebSocket 连接（在启动前连接，以便接收初始数据）
    // 注意：如果后端未运行，WebSocket 连接会失败，但不影响界面演示
    if (!wsManager.isConnected) {
      terminalRef.value?.writeOutput('Connecting to backend WebSocket...\r\n')
      try {
        await wsManager.connect()
        terminalRef.value?.writeOutput('\x1b[32mWebSocket connected\r\n\x1b[0m')
      } catch (error: any) {
        terminalRef.value?.writeOutput('\x1b[33mWarning: WebSocket connection failed (backend may not be running)\r\n\x1b[0m')
        terminalRef.value?.writeOutput('Continuing in demo mode...\r\n')
        // WebSocket 连接失败不影响界面演示，继续执行
      }
    }

    // 3. 初始化 WebSocket 监听
    initWebSocketListeners()

    // 4. 启动系统（调用后端 API）
    terminalRef.value?.writeOutput('Sending start request to backend...\r\n')
    try {
      const systemState = await systemStore.start(targetIP)
      terminalRef.value?.writeOutput('\x1b[32mBackend response received\r\n\x1b[0m')
    } catch (error: any) {
      terminalRef.value?.writeOutput('\x1b[33mWarning: Backend API call failed (backend may not be running)\r\n\x1b[0m')
      terminalRef.value?.writeOutput('Running in demo mode with mock data...\r\n')
      // API 调用失败时，设置系统状态为运行中（演示模式）
      systemStore.setStatus('running')
      systemStore.setTargetIP(targetIP)
    }

    // 5. 创建初始 target 节点（如果后端没有返回）
    await createInitialNode(targetIP)

    // 6. 加载初始数据
    await loadInitialData()

    // 7. 添加系统消息
    dialogStore.addSystemMessage('🚀 自动化渗透测试流程已启动')
    dialogStore.addSystemMessage(`🎯 目标IP: ${targetIP}`)
    dialogStore.addSystemMessage('系统将自动执行低风险操作，遇到高风险操作时将暂停等待审核')
    terminalRef.value?.writeOutput('Flow started successfully\r\n')
  } catch (error: any) {
    console.error('启动流程失败:', error)
    dialogStore.addErrorMessage(`启动失败: ${error.message || '未知错误'}`)
    systemStore.setError(error.message || '启动流程失败')
    terminalRef.value?.writeOutput(`\x1b[31mFailed to start flow: ${error.message || 'Unknown error'}\x1b[0m\r\n`)
  }
}

// 创建初始节点
async function createInitialNode(targetIP: string) {
  // 检查是否已有 target 节点
  const existingNodes = nodeStore.nodes.filter((n) => n.type === 'target')
  if (existingNodes.length > 0) {
    // 更新现有节点
    const node = existingNodes[0]
    nodeStore.updateNode({
      ...node,
      title: `TARGET\n${targetIP}`,
      metadata: { ...node.metadata, ip: targetIP },
    })
    return
  }

  // 创建新的 target 节点
  const containerWidth = window.innerWidth * 0.6 // 画布区域宽度
  const initialNode: Node = {
    id: `node-target-${Date.now()}`,
    type: 'target',
    title: `TARGET\n${targetIP}`,
    icon: 'fa-server',
    color: 'gray',
    x: containerWidth / 2,
    y: 100,
    status: 'pending',
    stage: 1,
    metadata: {
      ip: targetIP,
    },
  }

  nodeStore.addNode(initialNode)
  terminalRef.value?.writeOutput(`Initial target node created at (${initialNode.x}, ${initialNode.y})\r\n`)
}

// 初始化 WebSocket 监听
function initWebSocketListeners() {
  // 系统状态更新
  wsManager.on('system_status', (data: any) => {
    systemStore.updateSystemState(data)
  })

  // 节点更新
  wsManager.on('node_update', (data: Node | Node[]) => {
    if (Array.isArray(data)) {
      nodeStore.setNodes(data)
    } else {
      nodeStore.updateNode(data)
      // 如果节点状态变化，添加终端日志
      terminalRef.value?.writeOutput(`Node ${data.title} status: ${data.status}\r\n`)
    }
  })

  // 执行结果
  wsManager.on('execution_result', (data: { nodeId: string; result: any }) => {
    executionStore.updateExecutionResult(data.nodeId, data.result)
    const node = nodeStore.getNode(data.nodeId)
    if (node) {
      if (data.result.success) {
        dialogStore.addSuccessMessage(`节点 ${node.title} 执行成功`)
        terminalRef.value?.writeOutput(`\x1b[32m✓ ${node.title}: ${data.result.message}\x1b[0m\r\n`)
      } else {
        dialogStore.addErrorMessage(`节点 ${node.title} 执行失败: ${data.result.message}`)
        terminalRef.value?.writeOutput(`\x1b[31m✗ ${node.title}: ${data.result.message}\x1b[0m\r\n`)
      }
    }
  })

  // 线索添加
  wsManager.on('clue_added', (data: Clue) => {
    clueStore.addClue(data)
      dialogStore.addSystemMessage(`发现新线索: ${data.title}`)
      terminalRef.value?.writeOutput(`New clue discovered: ${data.title}\r\n`)
  })

  // 错误处理
  wsManager.on('error', (data: { message: string }) => {
    dialogStore.addErrorMessage(data.message)
    systemStore.setError(data.message)
    terminalRef.value?.writeOutput(`\x1b[31mError: ${data.message}\x1b[0m\r\n`)
  })
}

// 加载初始数据
async function loadInitialData() {
  try {
    // 加载节点
    await nodeStore.loadNodes()

    // 加载线索
    await clueStore.loadClues()

    // 加载执行历史
    await executionStore.loadHistory()
  } catch (error) {
    console.error('加载初始数据失败:', error)
  }
}

// 暂停/继续
async function handlePauseResume() {
  try {
    if (systemStore.isPaused) {
      await systemStore.resume()
      dialogStore.addSystemMessage('流程已继续')
      terminalRef.value?.writeOutput('Flow resumed\r\n')
    } else {
      await systemStore.pause()
      dialogStore.addSystemMessage('流程已暂停')
      terminalRef.value?.writeOutput('Flow paused\r\n')
    }
  } catch (error: any) {
    dialogStore.addErrorMessage(`操作失败: ${error.message}`)
  }
}


onMounted(() => {
  // 初始化 stores 的 WebSocket 监听
  systemStore.initWebSocket()
  nodeStore.initWebSocket()
  clueStore.initWebSocket()
  executionStore.initWebSocket()
})

onUnmounted(() => {
  // 清理 WebSocket 连接
  wsManager.disconnect()
})
</script>

<style scoped>
.home-container {
  font-family: 'Courier New', monospace;
}
</style>
