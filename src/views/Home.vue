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
    <TerminalPanel :lines="terminalLines" :show-cursor="true" />
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
const terminalLines = ref<Array<{ type: 'command' | 'output' | 'error'; content: string }>>([])

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
    addTerminalLine('output', `Starting automated penetration test for target: ${targetIP}`)

    // 2. 初始化 WebSocket 连接（在启动前连接，以便接收初始数据）
    if (!wsManager.isConnected) {
      addTerminalLine('output', 'Connecting to backend WebSocket...')
      await wsManager.connect()
      addTerminalLine('output', 'WebSocket connected')
    }

    // 3. 初始化 WebSocket 监听
    initWebSocketListeners()

    // 4. 启动系统（调用后端 API）
    addTerminalLine('output', 'Sending start request to backend...')
    const systemState = await systemStore.start(targetIP)
    addTerminalLine('output', 'Backend response received')

    // 5. 创建初始 target 节点（如果后端没有返回）
    await createInitialNode(targetIP)

    // 6. 加载初始数据
    await loadInitialData()

    // 7. 添加系统消息
    dialogStore.addSystemMessage('🚀 自动化渗透测试流程已启动')
    dialogStore.addSystemMessage(`🎯 目标IP: ${targetIP}`)
    dialogStore.addSystemMessage('系统将自动执行低风险操作，遇到高风险操作时将暂停等待审核')
    addTerminalLine('output', 'Flow started successfully')
  } catch (error: any) {
    console.error('启动流程失败:', error)
    dialogStore.addErrorMessage(`启动失败: ${error.message || '未知错误'}`)
    systemStore.setError(error.message || '启动流程失败')
    addTerminalLine('error', `Failed to start flow: ${error.message || 'Unknown error'}`)
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
  addTerminalLine('output', `Initial target node created at (${initialNode.x}, ${initialNode.y})`)
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
      addTerminalLine('output', `Node ${data.title} status: ${data.status}`)
    }
  })

  // 执行结果
  wsManager.on('execution_result', (data: { nodeId: string; result: any }) => {
    executionStore.updateExecutionResult(data.nodeId, data.result)
    const node = nodeStore.getNode(data.nodeId)
    if (node) {
      if (data.result.success) {
        dialogStore.addSuccessMessage(`节点 ${node.title} 执行成功`)
        addTerminalLine('output', `✓ ${node.title}: ${data.result.message}`)
      } else {
        dialogStore.addErrorMessage(`节点 ${node.title} 执行失败: ${data.result.message}`)
        addTerminalLine('error', `✗ ${node.title}: ${data.result.message}`)
      }
    }
  })

  // 线索添加
  wsManager.on('clue_added', (data: Clue) => {
    clueStore.addClue(data)
    dialogStore.addSystemMessage(`发现新线索: ${data.title}`)
    addTerminalLine('output', `New clue discovered: ${data.title}`)
  })

  // 错误处理
  wsManager.on('error', (data: { message: string }) => {
    dialogStore.addErrorMessage(data.message)
    systemStore.setError(data.message)
    addTerminalLine('error', `Error: ${data.message}`)
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
      addTerminalLine('output', 'Flow resumed')
    } else {
      await systemStore.pause()
      dialogStore.addSystemMessage('流程已暂停')
      addTerminalLine('output', 'Flow paused')
    }
  } catch (error: any) {
    dialogStore.addErrorMessage(`操作失败: ${error.message}`)
  }
}

// 添加终端日志
function addTerminalLine(
  type: 'command' | 'output' | 'error',
  content: string
) {
  terminalLines.value.push({
    type,
    content,
  })
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
