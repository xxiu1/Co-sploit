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
              'text-amber-400': systemStore.isPausing,
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
          v-if="systemStore.isRunning || systemStore.isPausing || systemStore.isPaused"
          @click="handlePauseResume"
          :disabled="systemStore.isPausing"
          class="text-xs bg-yellow-900 hover:bg-yellow-800 px-3 py-1.5 rounded text-yellow-300 transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <i :class="systemStore.isPaused ? 'fas fa-play' : systemStore.isPausing ? 'fas fa-hourglass-half' : 'fas fa-pause'"></i>
          <span>{{ systemStore.isPaused ? '继续' : systemStore.isPausing ? '正在暂停' : '暂停' }}</span>
        </button>
        <button
          v-if="systemStore.isRunning || systemStore.isPausing || systemStore.isPaused"
          @click="handleStop"
          class="text-xs bg-red-900 hover:bg-red-800 px-3 py-1.5 rounded text-red-300 transition-colors flex items-center gap-1.5"
          title="结束执行并保存输出日志"
        >
          <i class="fas fa-stop"></i>
          <span>结束执行</span>
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
    <TerminalPanel ref="terminalRef" @stop="handleStop" />

    <!-- 风险门控：待授权时展示决策简报 -->
    <DecisionBrief />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { CanvasView } from '@/components/Canvas'
import { DialogPanel } from '@/components/Dialog'
import { TerminalPanel } from '@/components/Terminal'
import { DecisionBrief } from '@/components/RiskGate'
import StartOverlay from '@/components/Common/StartOverlay.vue'
import {
  useSystemStore,
  useNodeStore,
  useClueStore,
  useExecutionStore,
  useDialogStore,
  useRiskGateStore,
  useActionStore,
} from '@/stores'
import { wsManager } from '@/utils/websocket'
import { generateNodeFromNextNode, generateConnection, getAttackSurfaceStage } from '@/utils/nodeGenerator'
import { getActionPlans, executeAction, getStateVersion } from '@/api'
import { generateId } from '@/utils'
import type { Node, Clue, WSMessage, Connection, ExecutionResult, ActionPlan, NextNode, SystemStatus } from '@/types'

const systemStore = useSystemStore()
const nodeStore = useNodeStore()
const clueStore = useClueStore()
const executionStore = useExecutionStore()
const dialogStore = useDialogStore()
const riskGateStore = useRiskGateStore()
const actionStore = useActionStore()

const showStartOverlay = computed(() => systemStore.isIdle)
const terminalRef = ref<InstanceType<typeof TerminalPanel>>()

const missionStatusText = computed(() => {
  if (systemStore.isRunning) return 'IN PROGRESS'
  if (systemStore.isPausing) return 'PAUSING'
  if (systemStore.isPaused) return 'PAUSED'
  if (systemStore.isCompleted) return 'COMPLETED'
  if (systemStore.isFailed) return 'MISSION FAILED'
  if (systemStore.hasError) return 'ERROR'
  return 'READY'
})

// 启动流程
async function handleStartFlow(targetIP: string) {
  try {
    // 0. 清空上一轮数据：与后端“每次运行清空 task/action”一致，避免画布残留历史节点
    actionStore.clearExecutingActions()
    nodeStore.reset()
    // 1. 添加系统消息
    dialogStore.addSystemMessage('🚀 正在启动自动化渗透测试流程...')
    terminalRef.value?.writeCommand(`Starting automated penetration test for target: ${targetIP}`)

    // 2. 初始化 WebSocket 连接（在启动前连接，以便接收实时更新）
    if (!wsManager.isConnected) {
      terminalRef.value?.writeOutput('Connecting to backend WebSocket...\r\n')
      try {
        await wsManager.connect()
        terminalRef.value?.writeOutput('\x1b[32mWebSocket connected\r\n\x1b[0m')
      } catch (error: any) {
        terminalRef.value?.writeOutput('\x1b[33mWarning: WebSocket connection failed\r\n\x1b[0m')
        // WebSocket 连接失败不影响基本功能，继续执行
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
      terminalRef.value?.writeOutput(`\x1b[31mError: Backend API call failed: ${error.message || 'Unknown error'}\x1b[0m\r\n`)
      throw error  // 重新抛出错误，让上层处理
    }

    // 5. 创建初始节点（目标设立），并设为“正在执行”以便前端在未生成 task 前显示黄色
    await createInitialNode(targetIP)
    const targetNode = nodeStore.nodes.find((n) => n.type === 'target')
    if (targetNode) {
      nodeStore.updateNode({ ...targetNode, status: 'executing' })
    }
    console.log('[DEBUG] 初始节点已创建:', targetIP)

    // 6. 加载初始数据（跳过节点：此时后端 Planner 可能已写入一批任务，不拉取以免画布“一开始就一堆节点”；节点由 WebSocket + 轮询逐步更新）
    await loadInitialData({ skipNodes: true })

    // 7. 添加系统消息
    dialogStore.addSystemMessage('🚀 自动化渗透测试流程已启动')
    dialogStore.addSystemMessage(`🎯 目标IP: ${targetIP}`)
    dialogStore.addSystemMessage('系统将自动执行低风险操作，遇到高风险操作时将暂停等待审核')
    terminalRef.value?.writeOutput('Flow started successfully\r\n')

    // 8. 启动自动化流程（处理执行队列）
    if (systemStore.isRunning && !systemStore.isPaused) {
      // 将初始节点添加到执行队列
      const targetNode = nodeStore.nodes.find((n) => n.type === 'target')
      if (targetNode && targetNode.status === 'pending') {
        executionStore.addToQueue({
          nodeType: targetNode.type,
          nodeId: targetNode.id,
          priority: 10,
          timestamp: new Date().toISOString(),
        })
        // 开始处理队列
        setTimeout(() => {
          processExecutionQueue()
        }, 500)
      }
    }
  } catch (error: any) {
    console.error('启动流程失败:', error)
    dialogStore.addErrorMessage(`启动失败: ${error.message || '未知错误'}`)
    systemStore.setError(error.message || '启动流程失败')
    terminalRef.value?.writeOutput(`\x1b[31mFailed to start flow: ${error.message || 'Unknown error'}\x1b[0m\r\n`)
    // 不再加载演示数据，只显示错误
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
    nodeStore.regenerateConnections()
    nodeStore.calculateTreeLayout()
    return
  }

  // 创建新的 target 节点 - 确保在可见区域内
  const containerWidth = window.innerWidth * 0.6 // 画布区域宽度
  const containerHeight = window.innerHeight * 0.8 // 画布区域高度
  const initialNode: Node = {
    id: `node-target-${Date.now()}`,
    type: 'target',
    title: `TARGET\n${targetIP}`,
    icon: 'fa-server',
    color: 'gray',
    x: Math.max(400, containerWidth / 2), // 确保在可见区域内
    y: Math.max(200, containerHeight / 2 - 100), // 确保在可见区域内
    status: 'pending',
    stage: 1,
    metadata: {
      ip: targetIP,
    },
  }

  nodeStore.addNode(initialNode)
  nodeStore.regenerateConnections()
  nodeStore.calculateTreeLayout()
  terminalRef.value?.writeOutput(`Initial target node created at (${initialNode.x}, ${initialNode.y})\r\n`)
}

// 初始化 WebSocket 监听
function initWebSocketListeners() {
  // 系统状态更新
  wsManager.on('system_status', (data: any) => {
    systemStore.updateSystemState(data)
  })

  // 节点更新：收到数组时做合并，保留前端根节点，避免连线消失；单条更新后也重算连线
  wsManager.on('node_update', (data: Node | Node[]) => {
    if (Array.isArray(data)) {
      const roots = nodeStore.nodes.filter(
        (n) => n.type === 'target' || (n.id != null && String(n.id).startsWith('node-target-'))
      )
      const backendIds = new Set(data.map((n) => n.id))
      const merged: Node[] = [...data]
      for (const r of roots) {
        if (!backendIds.has(r.id)) merged.push(r)
      }
      nodeStore.setNodes(merged)
      nodeStore.regenerateConnections()
    } else {
      const isTaskExecuting =
        (data.type === 'task' || (data.id != null && String(data.id).startsWith('task-'))) &&
        (data.status === 'executing' || data.status === 'in_progress')
      if (isTaskExecuting) {
        const targets = nodeStore.nodes.filter(
          (n) => n.type === 'target' || (n.id != null && String(n.id).startsWith('node-target-'))
        )
        for (const t of targets) {
          nodeStore.updateNode({ ...t, status: 'success' })
        }
      }
      nodeStore.updateNode(data)
      nodeStore.regenerateConnections()
      // 如果节点状态变化，添加终端日志
      terminalRef.value?.writeOutput(`Node ${data.title} status: ${data.status}\r\n`)
    }
  })

  // 执行结果
  wsManager.on('execution_result', async (data: { nodeId: string; result: ExecutionResult; actionPlanId?: string }) => {
    const node = nodeStore.getNode(data.nodeId)
    if (!node) return

    // 处理执行结果
    if (data.actionPlanId) {
      await handleExecutionResult(data.nodeId, data.result, data.actionPlanId)
    } else {
      // 如果没有 actionPlanId，只更新状态
      executionStore.updateExecutionResult(data.nodeId, data.result)
      const newStatus = data.result.success ? 'success' : 'failed'
      await nodeStore.updateNodeStatusById(data.nodeId, newStatus)
      nodeStore.updateNode({ ...node, status: newStatus })

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

  // Human intervention (Cross-Modal Assistance — Capability 1)
  wsManager.on('intervention_request', (data: Record<string, unknown>) => {
    dialogStore.addInterventionMessage(data)
    systemStore.updateSystemState({
      status: 'paused',
      targetIP: systemStore.targetIP,
      currentExecutionNode: systemStore.currentExecutionNode,
    })
    terminalRef.value?.writeOutput('\r\n[Intervention] Cross-modal assistance required — check CO-PILOT panel.\r\n')
  })

  wsManager.on('intervention_resolved', (data: { intervention_id?: string; status?: string }) => {
    if (data?.intervention_id) {
      dialogStore.setInterventionSubmitted(String(data.intervention_id))
    }
    systemStore.updateSystemState({
      status: 'running',
      targetIP: systemStore.targetIP,
      currentExecutionNode: systemStore.currentExecutionNode,
    })
  })
}

// 加载初始数据（skipNodes: true 时启动瞬间不拉节点，避免画布“一开始就一堆节点”，由 WebSocket + 轮询逐步更新）
async function loadInitialData(options?: { skipNodes?: boolean }) {
  const skipNodes = options?.skipNodes === true
  try {
    if (!skipNodes) {
      await nodeStore.loadNodes()
    }
    await clueStore.loadClues()
    try {
      await executionStore.loadHistory()
    } catch (error) {
      console.warn('加载执行历史失败（不影响其他功能）:', error)
    }
  } catch (error) {
    console.error('加载初始数据失败:', error)
    terminalRef.value?.writeOutput(`\x1b[33mWarning: Failed to load initial data from backend\x1b[0m\r\n`)
  }
}

// 演示模式：加载本地模拟数据
async function loadDemoData(targetIP: string) {
  terminalRef.value?.writeOutput('\x1b[33mEntering demo mode with local mock data...\x1b[0m\r\n')

  // 模拟节点与连线
  const demoNodes: Node[] = [
    {
      id: 'node-attacker',
      type: 'attacker',
      title: 'ATTACKER\n10.10.10.1',
      icon: 'fa-laptop-code',
      color: 'purple',
      x: 120,
      y: 220,
      status: 'success',
      stage: 0,
    },
    {
      id: 'node-target',
      type: 'target',
      title: `TARGET\n${targetIP}`,
      icon: 'fa-server',
      color: 'gray',
      x: 520,
      y: 100,
      status: 'executing',
      stage: 1,
      metadata: { ip: targetIP },
    },
    {
      id: 'node-smb',
      type: 'smb',
      title: 'SMB Service',
      icon: 'fa-network-wired',
      color: 'blue',
      x: 420,
      y: 280,
      status: 'pending',
      stage: 1,
    },
    {
      id: 'node-ldap',
      type: 'ldap',
      title: 'LDAP Enum',
      icon: 'fa-database',
      color: 'green',
      x: 620,
      y: 280,
      status: 'pending',
      stage: 1,
    },
  ]

  const demoConnections: Connection[] = [
    { id: 'conn-1', fromNodeId: 'node-attacker', toNodeId: 'node-target' },
    { id: 'conn-2', fromNodeId: 'node-target', toNodeId: 'node-smb' },
    { id: 'conn-3', fromNodeId: 'node-target', toNodeId: 'node-ldap' },
  ]

  nodeStore.setNodes(demoNodes)
  nodeStore.setConnections(demoConnections)

  // 模拟线索
  const now = new Date().toISOString()
  const demoClues: Clue[] = [
    {
      id: 'clue-1',
      type: 'service',
      title: '发现开放端口 445 (SMB)',
      metadata: { port: 445, service: 'smb' },
      createdAt: now,
    },
    {
      id: 'clue-2',
      type: 'service',
      title: '发现开放端口 389 (LDAP)',
      metadata: { port: 389, service: 'ldap' },
      createdAt: now,
    },
  ]
  clueStore.setClues(demoClues)

  // 模拟执行历史
  const demoHistory = [
    {
      id: 'hist-1',
      nodeId: 'node-target',
      nodeType: 'target',
      actionPlan: {
        id: 'plan-1',
        title: '初始全端口扫描',
        tool: 'nmap',
        cmd: `nmap -sC -sV -p- ${targetIP}`,
        risk: 'Moderate',
        riskScore: 5,
      },
      result: {
        success: true,
        message: '发现端口 445/389 开放',
      } as ExecutionResult,
      timestamp: now,
      status: 'success',
    },
  ]
  executionStore.setHistory(demoHistory as any)

  // 系统状态设置为运行中
  systemStore.setStatus('running')
  systemStore.setTargetIP(targetIP)

  dialogStore.addSystemMessage('已加载本地模拟数据（演示模式）')
  terminalRef.value?.writeOutput('\x1b[32mDemo data loaded\r\n\x1b[0m')
}

// 暂停/继续
async function handlePauseResume() {
  try {
    if (systemStore.isPaused) {
      await systemStore.resume()
      dialogStore.addSystemMessage('流程已继续')
      terminalRef.value?.writeOutput('Flow resumed\r\n')
      // 继续处理执行队列
      processExecutionQueue()
    } else {
      await systemStore.pause()
      dialogStore.addSystemMessage('正在暂停，等待当前任务完成后将暂停...')
      terminalRef.value?.writeOutput('Pausing... (waiting for current task to finish)\r\n')
    }
  } catch (error: any) {
    dialogStore.addErrorMessage(`操作失败: ${error.message}`)
  }
}

// 停止流程（保存完整输出日志）
async function handleStop() {
  try {
    terminalRef.value?.writeOutput('Stopping and saving log...\r\n')
    await systemStore.stop()
    dialogStore.addSystemMessage('流程已停止，输出日志已保存')
    terminalRef.value?.writeOutput('Flow stopped. Log saved.\r\n')
  } catch (error: any) {
    dialogStore.addErrorMessage(`停止失败: ${error.message}`)
  }
}

// ========== 操作执行逻辑 ==========

/**
 * 执行操作计划
 */
async function executeActionPlan(
  nodeId: string,
  actionPlanId: string,
  modifiedCmd?: string
) {
  const node = nodeStore.getNode(nodeId)
  if (!node) {
    dialogStore.addErrorMessage('节点不存在')
    return
  }

  try {
    // 1. 更新节点状态为 executing
    await nodeStore.updateNodeStatusById(nodeId, 'executing')
    nodeStore.updateNode({ ...node, status: 'executing' })
    systemStore.setCurrentExecutionNode(nodeId)

    // 2. 更新对话框消息状态
    const message = dialogStore.messages.find(
      (m) => m.actionData?.plan.id === actionPlanId
    )
    if (message) {
      dialogStore.updateActionMessageStatus(message.id, 'executing')
    }

    // 3. 显示执行信息
    dialogStore.addSystemMessage(`开始执行: ${node.title}`)
    terminalRef.value?.writeCommand(`Executing action: ${node.title}`)

    // 4. 调用后端 API 执行操作
    const result: ExecutionResult = await executeAction({
      nodeType: node.type,
      actionPlanId,
      modifiedCmd,
    })

    // 5. 处理执行结果
    await handleExecutionResult(nodeId, result, actionPlanId)

    // 6. 从执行队列中移除
    executionStore.removeFromQueue(nodeId)
  } catch (error: any) {
    console.error('执行操作失败:', error)
    
    // 更新节点状态为失败
    await nodeStore.updateNodeStatusById(nodeId, 'failed')
    nodeStore.updateNode({ ...node, status: 'failed' })

    // 更新消息状态
    const message = dialogStore.messages.find(
      (m) => m.actionData?.plan.id === actionPlanId
    )
    if (message) {
      dialogStore.updateActionMessageStatus(message.id, 'failed')
      dialogStore.updateActionMessageResult(message.id, {
        success: false,
        message: error.message || '执行失败',
      })
    }

    dialogStore.addErrorMessage(`执行失败: ${error.message || '未知错误'}`)
    terminalRef.value?.writeOutput(`\x1b[31mExecution failed: ${error.message}\x1b[0m\r\n`)
  }
}

/**
 * 处理执行结果
 */
async function handleExecutionResult(
  nodeId: string,
  result: ExecutionResult,
  actionPlanId: string
) {
  const node = nodeStore.getNode(nodeId)
  if (!node) return

  // 1. 更新节点状态
  const newStatus = result.success ? 'success' : 'failed'
  await nodeStore.updateNodeStatusById(nodeId, newStatus)
  nodeStore.updateNode({ ...node, status: newStatus })

  // 2. 更新执行历史
  executionStore.completeExecution(nodeId, result)

  // 3. 更新对话框消息
  const message = dialogStore.messages.find(
    (m) => m.actionData?.plan.id === actionPlanId
  )
  if (message) {
    dialogStore.updateActionMessageStatus(message.id, newStatus)
    dialogStore.updateActionMessageResult(message.id, result)
  }

  // 4. 显示结果
  if (result.success) {
    dialogStore.addSuccessMessage(`节点 ${node.title} 执行成功`)
    terminalRef.value?.writeOutput(`\x1b[32m✓ ${node.title}: ${result.message}\x1b[0m\r\n`)
    
    // 5. 如果成功，生成后续节点
    await generateNextNodes(nodeId, actionPlanId)
  } else {
    dialogStore.addErrorMessage(`节点 ${node.title} 执行失败: ${result.message}`)
    terminalRef.value?.writeOutput(`\x1b[31m✗ ${node.title}: ${result.message}\x1b[0m\r\n`)
    
    // 显示失败分析和建议
    if (result.analysis) {
      dialogStore.addSystemMessage(`分析: ${result.analysis}`)
    }
    if (result.suggestions && result.suggestions.length > 0) {
      dialogStore.addSystemMessage(`建议: ${result.suggestions.join(', ')}`)
    }
  }

  // 6. 清除当前执行节点
  if (systemStore.currentExecutionNode === nodeId) {
    systemStore.setCurrentExecutionNode(undefined)
  }
}

/**
 * 生成后续节点
 */
async function generateNextNodes(nodeId: string, actionPlanId: string) {
  const node = nodeStore.getNode(nodeId)
  if (!node) return

  // 获取操作计划（从消息中或重新获取）
  const message = dialogStore.messages.find(
    (m) => m.actionData?.plan.id === actionPlanId
  )
  const actionPlan = message?.actionData?.plan

  if (!actionPlan || !actionPlan.nextNodes || actionPlan.nextNodes.length === 0) {
    return
  }

  // 生成新节点
  const newNodes: Node[] = []
  const newConnections: Connection[] = []

  actionPlan.nextNodes.forEach((nextNode: NextNode, index: number) => {
    // 检查节点是否已存在（避免重复创建）
    const existingNode = nodeStore.nodes.find((n) => n.type === nextNode.type)
    if (existingNode) {
      // 如果节点已存在，只创建连线
      const connection = generateConnection(nodeId, existingNode.id)
      newConnections.push(connection)
      return
    }

    // 生成新节点
    const newNode = generateNodeFromNextNode(
      nextNode,
      node,
      index,
      actionPlan.nextNodes!.length
    )
    newNodes.push(newNode)

    // 生成连线
    const connection = generateConnection(nodeId, newNode.id)
    newConnections.push(connection)
  })

  // 添加到画布
  newNodes.forEach((newNode) => {
    nodeStore.addNode(newNode)
    dialogStore.addSystemMessage(`发现新节点: ${newNode.title}`)
    terminalRef.value?.writeOutput(`New node created: ${newNode.title}\r\n`)

    // 添加到执行队列（如果风险等级为 Low，自动执行）
    executionStore.addToQueue({
      nodeType: newNode.type,
      nodeId: newNode.id,
      priority: actionPlan.priority || 0,
      timestamp: new Date().toISOString(),
    })
  })

  // 添加连线
  newConnections.forEach((conn) => {
    nodeStore.addConnection(conn)
  })

  // 如果系统正在运行且未暂停，自动处理新节点
  if (systemStore.isRunning && !systemStore.isPaused) {
    processExecutionQueue()
  }
}

/**
 * 处理操作确认（从对话框调用）
 */
async function handleActionConfirm(messageId: string, actionPlanId: string) {
  const message = dialogStore.messages.find((m) => m.id === messageId)
  if (!message || !message.actionData) {
    return
  }

  const actionData = message.actionData
  const nodeType = actionData.nodeType || actionData.plan.id.split('-')[0]

  // 查找对应的节点
  const node = nodeStore.nodes.find((n) => n.type === nodeType)
  if (!node) {
    dialogStore.addErrorMessage('找不到对应的节点')
    return
  }

  // 执行操作计划
  await executeActionPlan(node.id, actionPlanId)
}

/**
 * 处理操作取消
 */
function handleActionCancel(messageId: string) {
  const message = dialogStore.messages.find((m) => m.id === messageId)
  if (message && message.actionData) {
    dialogStore.updateActionMessageStatus(message.id, 'failed')
    dialogStore.addSystemMessage('操作已取消')
  }
}

/**
 * 处理命令修改
 */
async function handleActionModify(messageId: string, modifiedCmd: string) {
  const message = dialogStore.messages.find((m) => m.id === messageId)
  if (!message || !message.actionData) {
    return
  }

  const actionPlanId = message.actionData.plan.id
  const nodeType = message.actionData.nodeType || message.actionData.plan.id.split('-')[0]

  // 查找对应的节点
  const node = nodeStore.nodes.find((n) => n.type === nodeType)
  if (!node) {
    dialogStore.addErrorMessage('找不到对应的节点')
    return
  }

  // 更新操作计划中的命令
  if (message.actionData.plan) {
    message.actionData.plan.cmd = modifiedCmd
    message.actionData.plan.isCustom = true
  }

  dialogStore.addSystemMessage('命令已修改，准备执行...')
  
  // 执行修改后的命令
  await executeActionPlan(node.id, actionPlanId, modifiedCmd)
}

/**
 * 处理执行队列（自动化流程控制）
 */
async function processExecutionQueue() {
  // 如果系统暂停或未运行，不处理队列
  if (!systemStore.isRunning || systemStore.isPaused) {
    return
  }

  // 获取待执行的队列项
  const pendingItems = executionStore.pendingQueue
  if (pendingItems.length === 0) {
    return
  }

  // 处理队列中的第一个项
  const queueItem = pendingItems[0]
  const node = nodeStore.getNode(queueItem.nodeId)
  if (!node) {
    executionStore.removeFromQueue(queueItem.nodeId)
    return
  }

  // 如果节点不是 pending 状态，跳过
  if (node.status !== 'pending') {
    executionStore.removeFromQueue(queueItem.nodeId)
    processExecutionQueue() // 处理下一个
    return
  }

  try {
    // 获取节点的操作计划
    let scenario = null
    try {
      scenario = await getActionPlans(node.type)
    } catch (err: any) {
      // 404 错误表示后端未实现此端点，跳过
      if (err?.response?.status === 404) {
        console.warn('getActionPlans 端点未实现，跳过操作计划获取')
      } else {
        throw err // 其他错误继续抛出
      }
    }
    
    if (!scenario || !scenario.actionPlans || scenario.actionPlans.length === 0) {
      // 如果没有操作计划，从队列中移除并处理下一个
      executionStore.removeFromQueue(queueItem.nodeId)
      processExecutionQueue()
      return
    }

    // 选择第一个操作计划（或根据优先级选择）
    const actionPlan = scenario.actionPlans[0]

    // 根据风险等级决定是否自动执行
    if (actionPlan.risk === 'Low') {
      // 低风险：自动执行
      dialogStore.addSystemMessage(`自动执行低风险操作: ${actionPlan.title}`)
      await executeActionPlan(node.id, actionPlan.id)
    } else {
      // 中高风险：显示操作计划，等待用户确认
      dialogStore.addActionMessage({
        plan: actionPlan,
        status: 'pending',
        prediction: actionPlan.predictedOutcome,
        nodeDescription: node.title,
        nodeType: node.type,
      })
      dialogStore.addSystemMessage(
        `发现 ${actionPlan.risk} 风险操作，等待用户确认: ${actionPlan.title}`
      )
      // 不自动执行，等待用户确认
    }
  } catch (error: any) {
    console.error('处理执行队列失败:', error)
    executionStore.removeFromQueue(queueItem.nodeId)
    processExecutionQueue()
  }
}

// 监听执行队列变化，自动处理
watch(
  () => executionStore.queueLength,
  () => {
    if (systemStore.isRunning && !systemStore.isPaused) {
      processExecutionQueue()
    }
  }
)

// 监听系统状态变化
watch(
  () => [systemStore.isRunning, systemStore.isPaused],
  ([isRunning, isPaused]) => {
    if (isRunning && !isPaused) {
      processExecutionQueue()
    }
  }
)


// 定时轮询：采用「版本轮询」— 只轮询轻量 /api/state/version，仅在计数变化时拉取 nodes/actions/clues
const POLL_INTERVAL_MS = 3000
let nodesPollInterval: ReturnType<typeof setInterval> | null = null
let lastDataVersion: { tasks: number; actions: number; clues: number } | null = null

function startNodesPolling() {
  if (nodesPollInterval) {
    clearInterval(nodesPollInterval)
  }
  lastDataVersion = null
  nodesPollInterval = setInterval(async () => {
    if (!systemStore.isRunning && !systemStore.isPaused) return
    try {
      const v = await getStateVersion()
      const next = { tasks: v.tasks, actions: v.actions, clues: v.clues }
      const changed =
        lastDataVersion === null ||
        lastDataVersion.tasks !== next.tasks ||
        lastDataVersion.actions !== next.actions ||
        lastDataVersion.clues !== next.clues
      if (changed) {
        lastDataVersion = next
        await nodeStore.loadNodes()
        await clueStore.loadClues()
        await actionStore.fetchExecutingActions()
        await riskGateStore.fetchPendingBrief()
      }
    } catch (error) {
      console.error('轮询数据版本失败:', error)
    }
  }, POLL_INTERVAL_MS)
}

function stopNodesPolling() {
  if (nodesPollInterval) {
    clearInterval(nodesPollInterval)
    nodesPollInterval = null
  }
  lastDataVersion = null
}

// 监听系统状态变化，自动开始/停止轮询
// 注意：只在状态从非运行状态变为运行状态时才开始轮询，避免页面刷新后自动开始
let previousStatus: SystemStatus = 'idle'
let isInitialMount = true

watch(() => systemStore.status, async (newStatus) => {
  if (isInitialMount) {
    previousStatus = newStatus
    isInitialMount = false
    if (newStatus === 'running' || newStatus === 'pausing' || newStatus === 'paused') {
      startNodesPolling()
      try {
        await nodeStore.loadNodes()
        await clueStore.loadClues()
        await riskGateStore.fetchPendingBrief()
      } catch (error) {
        console.error('初始加载节点数据失败:', error)
      }
    }
    return
  }

  if (newStatus === 'paused' && previousStatus !== 'paused') {
    actionStore.clearExecutingActions()
    dialogStore.addSystemMessage('已暂停')
    terminalRef.value?.writeOutput('Paused.\r\n')
  }

  if ((newStatus === 'running' || newStatus === 'pausing' || newStatus === 'paused') &&
      previousStatus !== 'running' && previousStatus !== 'pausing' && previousStatus !== 'paused') {
    startNodesPolling()
    try {
      await riskGateStore.fetchPendingBrief()
    } catch (_) {}
  } else if (newStatus === 'completed') {
    stopNodesPolling()
    try {
      await nodeStore.loadNodes()
      await clueStore.loadClues()
    } catch (error) {
      console.warn('系统完成后加载节点失败:', error)
    }
  } else if (newStatus !== 'running' && newStatus !== 'pausing' && newStatus !== 'paused') {
    stopNodesPolling()
  }

  previousStatus = newStatus
})

onMounted(() => {
  // 初始化 stores 的 WebSocket 监听
  systemStore.initWebSocket()
  nodeStore.initWebSocket()
  clueStore.initWebSocket()
  executionStore.initWebSocket()
  
  stopNodesPolling()

  // 初始化 previousStatus
  previousStatus = systemStore.status
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
