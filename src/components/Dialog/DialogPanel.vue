<template>
  <aside
    class="dialog-panel w-[700px] glass flex flex-col z-30 border-l border-dark-border bg-dark-panel"
  >
    <!-- 头部 -->
    <div
      class="h-12 border-b border-dark-border flex items-center px-4 bg-[#161822] justify-between shrink-0"
    >
      <span class="font-bold text-white">
        <i class="fas fa-robot text-purple-500 mr-2"></i> CO-PILOT
      </span>
      <div class="flex items-center gap-2">
        <button
          @click="showCluesList"
          class="text-[10px] bg-blue-900 hover:bg-blue-800 px-2 py-1 rounded text-blue-300 transition-colors flex items-center gap-1"
        >
          <i class="fas fa-database"></i> 线索
        </button>
        <span class="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400">
          {{ panelState }}
        </span>
      </div>
    </div>

    <!-- 消息列表 -->
    <div
      ref="messagesContainerRef"
      class="flex-1 p-4 space-y-3 overflow-y-auto"
      @scroll="handleScroll"
    >
      <div v-if="messages.length === 0" class="text-center text-gray-500 py-8">
        <i class="fas fa-comments text-4xl mb-4 opacity-50"></i>
        <p class="text-sm">等待开始渗透测试流程...</p>
      </div>

      <DialogMessage
        v-for="message in messages"
        :key="message.id"
        :message="message"
        @action-confirm="handleActionConfirm"
        @action-cancel="handleActionCancel"
        @action-modify="handleActionModify"
      />
    </div>

    <!-- 用户输入区域 -->
    <div class="border-t border-dark-border p-3 bg-[#161822] shrink-0">
      <!-- 已选择的线索/节点显示 -->
      <div
        v-if="selectedItems.length > 0"
        class="mb-2 flex flex-wrap gap-1.5"
      >
        <div
          v-for="item in selectedItems"
          :key="item.id"
          class="bg-purple-900/50 border border-purple-700 text-purple-300 px-2 py-1 rounded text-xs flex items-center gap-1"
        >
          <span>{{ item.label }}</span>
          <button
            @click="removeSelectedItem(item.id)"
            class="hover:text-purple-100"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- 输入框和按钮 -->
      <div class="flex gap-2">
        <button
          @click="showSelectionMenu"
          class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5"
          title="选择线索或节点"
        >
          <i class="fas fa-plus"></i>
        </button>
        <input
          v-model="userInput"
          type="text"
          placeholder="输入消息或命令，或选择线索/节点后输入提示..."
          class="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
          @keypress.enter="sendUserMessage"
        />
        <button
          @click="sendUserMessage"
          class="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
        >
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
      <div class="mt-2 text-[10px] text-gray-500">
        💡 提示: 可以询问系统状态、请求执行特定操作、查看可用Action列表，或点击➕选择线索/节点进行组合规划
      </div>
    </div>

    <!-- 线索/节点选择菜单（模态框） -->
    <SelectionMenu
      v-if="showMenu"
      @close="showMenu = false"
      @select="handleItemSelect"
    />

    <!-- 线索列表弹窗 -->
    <div
      v-if="showClueListModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showClueListModal = false"
    >
      <div class="bg-dark-panel border border-dark-border rounded-lg w-[500px] max-h-[85vh] overflow-hidden flex flex-col">
        <div class="p-4 border-b border-dark-border flex items-center justify-between shrink-0">
          <h3 class="font-bold text-white">
            <i class="fas fa-database mr-2"></i>线索列表
          </h3>
          <button
            type="button"
            class="text-gray-400 hover:text-white"
            @click="showClueListModal = false"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <div v-if="clueStore.sortedClues.length === 0" class="text-center text-gray-500 py-8 text-sm">
            暂无线索
          </div>
          <div
            v-for="clue in clueStore.sortedClues"
            :key="clue.id"
            class="p-3 rounded-lg bg-gray-900/80 border border-gray-700"
          >
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-medium text-white">{{ clue.title }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{{ clue.type }}</span>
            </div>
            <div v-if="clueDescription(clue)" class="text-xs text-gray-400 mt-1 whitespace-pre-wrap border-t border-gray-700 pt-2 mt-1">
              {{ clueDescription(clue) }}
            </div>
            <div v-else class="text-[10px] text-gray-500 mt-1 italic">暂无分析</div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useDialogStore, useSystemStore, useNodeStore, useExecutionStore, useActionStore, useClueStore } from '@/stores'
import { executeAction, replanWithContext } from '@/api'
import { generateNodeFromNextNode, generateConnection } from '@/utils/nodeGenerator'
import type { Node, NextNode, Connection } from '@/types'
import DialogMessage from './DialogMessage.vue'
import SelectionMenu from './SelectionMenu.vue'

const dialogStore = useDialogStore()
const systemStore = useSystemStore()
const nodeStore = useNodeStore()
const executionStore = useExecutionStore()
const actionStore = useActionStore()
const clueStore = useClueStore()

const messagesContainerRef = ref<HTMLElement>()
const userInput = ref('')
const selectedItems = ref<Array<{ id: string; type: string; label: string }>>([])
const showMenu = ref(false)
const showClueListModal = ref(false)

const messages = computed(() => dialogStore.messages)
const panelState = computed(() => {
  if (systemStore.isRunning) return 'RUNNING'
  if (systemStore.isPaused) return 'PAUSED'
  if (systemStore.isCompleted) return 'COMPLETED'
  return 'READY'
})

// 自动滚动
watch(
  () => messages.value.length,
  async () => {
    if (dialogStore.autoScroll) {
      await nextTick()
      scrollToBottom()
    }
  }
)

function scrollToBottom() {
  if (messagesContainerRef.value) {
    messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
  }
}

function handleScroll() {
  // 检测是否滚动到底部
  if (messagesContainerRef.value) {
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.value
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10
    dialogStore.setAutoScroll(isAtBottom)
  }
}

async function sendUserMessage() {
  const prompt = userInput.value.trim()
  if (!prompt && selectedItems.value.length === 0) return

  if ((systemStore.isPaused || systemStore.isCompleted) && (selectedItems.value.length > 0 || prompt)) {
    const nodeIds = selectedItems.value.filter((i) => i.type === 'node').map((i) => i.id)
    const clueIds = selectedItems.value.filter((i) => i.type === 'clue').map((i) => i.id)
    try {
      const res = await replanWithContext({ prompt: prompt || '', nodeIds, clueIds })
      if (res?.status) systemStore.updateSystemState(res)
      dialogStore.addSystemMessage('已提交重新规划请求，系统将根据所选节点与线索重新执行')
      userInput.value = ''
      selectedItems.value = []
    } catch (err: any) {
      dialogStore.addErrorMessage(err?.message || '重新规划请求失败')
    }
    return
  }

  if (prompt) {
    dialogStore.addUserMessage(prompt)
    userInput.value = ''
    selectedItems.value = []
  }
}

async function showCluesList() {
  showClueListModal.value = true
  try {
    await clueStore.loadClues()
  } catch (_) {}
}

async function showSelectionMenu() {
  showMenu.value = true
  try {
    await clueStore.loadClues()
  } catch (_) {}
}

function handleItemSelect(item: { id: string; type: string; label: string }) {
  selectedItems.value.push(item)
  showMenu.value = false
}

function removeSelectedItem(id: string) {
  const index = selectedItems.value.findIndex((item) => item.id === id)
  if (index >= 0) {
    selectedItems.value.splice(index, 1)
  }
}

function clueDescription(clue: { metadata?: Record<string, unknown>; analysis?: string }): string {
  const desc = clue.metadata?.clue_description ?? clue.analysis
  return typeof desc === 'string' && desc.trim() ? desc.trim() : ''
}

// 初始化 Action Store
let refreshInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  // 初始化 WebSocket 监听
  actionStore.initWebSocketListeners()
  
  // 获取正在执行的 actions
  await actionStore.fetchExecutingActions()
  
  // 定期刷新正在执行的 actions（每5秒）
  refreshInterval = setInterval(() => {
    actionStore.fetchExecutingActions()
  }, 5000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
  actionStore.cleanupWebSocketListeners()
})

// 处理操作确认
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

  try {
    // 更新节点状态为 executing
    await nodeStore.updateNodeStatusById(node.id, 'executing')
    nodeStore.updateNode({ ...node, status: 'executing' })
    systemStore.setCurrentExecutionNode(node.id)

    // 更新对话框消息状态
    dialogStore.updateActionMessageStatus(messageId, 'executing')

    // 显示执行信息
    dialogStore.addSystemMessage(`开始执行: ${node.title}`)

    // 调用后端 API 执行操作
    const result = await executeAction({
      nodeType: node.type,
      actionPlanId,
    })

    // 处理执行结果（通过 WebSocket 或直接处理）
    // 这里的结果会通过 WebSocket 的 execution_result 消息处理
    // 如果 WebSocket 不可用，直接更新状态
    if (result) {
      executionStore.completeExecution(node.id, result)
      const newStatus = result.success ? 'success' : 'failed'
      await nodeStore.updateNodeStatusById(node.id, newStatus)
      dialogStore.updateActionMessageStatus(messageId, newStatus)
      dialogStore.updateActionMessageResult(messageId, result)

      if (result.success) {
        dialogStore.addSuccessMessage(`节点 ${node.title} 执行成功`)
        // 生成后续节点
        await generateNextNodes(node.id, actionPlanId, message.actionData.plan)
      } else {
        dialogStore.addErrorMessage(`节点 ${node.title} 执行失败: ${result.message}`)
      }
    }
  } catch (error: any) {
    console.error('执行操作失败:', error)
    await nodeStore.updateNodeStatusById(node.id, 'failed')
    dialogStore.updateActionMessageStatus(messageId, 'failed')
    dialogStore.updateActionMessageResult(messageId, {
      success: false,
      message: error.message || '执行失败',
    })
    dialogStore.addErrorMessage(`执行失败: ${error.message || '未知错误'}`)
  }
}

// 处理操作取消
function handleActionCancel(messageId: string) {
  const message = dialogStore.messages.find((m) => m.id === messageId)
  if (message && message.actionData) {
    dialogStore.updateActionMessageStatus(messageId, 'failed')
    dialogStore.addSystemMessage('操作已取消')
  }
}

// 处理命令修改
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

  try {
    // 更新节点状态为 executing
    await nodeStore.updateNodeStatusById(node.id, 'executing')
    nodeStore.updateNode({ ...node, status: 'executing' })
    systemStore.setCurrentExecutionNode(node.id)

    // 更新对话框消息状态
    dialogStore.updateActionMessageStatus(messageId, 'executing')

    // 调用后端 API 执行修改后的命令
    const result = await executeAction({
      nodeType: node.type,
      actionPlanId,
      modifiedCmd,
    })

    // 处理执行结果
    if (result) {
      executionStore.completeExecution(node.id, result)
      const newStatus = result.success ? 'success' : 'failed'
      await nodeStore.updateNodeStatusById(node.id, newStatus)
      dialogStore.updateActionMessageStatus(messageId, newStatus)
      dialogStore.updateActionMessageResult(messageId, result)

      if (result.success) {
        dialogStore.addSuccessMessage(`节点 ${node.title} 执行成功`)
        // 生成后续节点
        await generateNextNodes(node.id, actionPlanId, message.actionData.plan)
      } else {
        dialogStore.addErrorMessage(`节点 ${node.title} 执行失败: ${result.message}`)
      }
    }
  } catch (error: any) {
    console.error('执行修改后的命令失败:', error)
    await nodeStore.updateNodeStatusById(node.id, 'failed')
    dialogStore.updateActionMessageStatus(messageId, 'failed')
    dialogStore.updateActionMessageResult(messageId, {
      success: false,
      message: error.message || '执行失败',
    })
    dialogStore.addErrorMessage(`执行失败: ${error.message || '未知错误'}`)
  }
}

/**
 * 生成后续节点
 */
async function generateNextNodes(
  nodeId: string,
  _actionPlanId: string,
  actionPlan: any
) {
  const node = nodeStore.getNode(nodeId)
  if (!node || !actionPlan || !actionPlan.nextNodes || actionPlan.nextNodes.length === 0) {
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
      actionPlan.nextNodes.length
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

    // 添加到执行队列
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
}
</script>

<style scoped>
.glass {
  background: rgba(20, 22, 32, 0.95);
}
</style>

