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
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useDialogStore, useSystemStore } from '@/stores'
import DialogMessage from './DialogMessage.vue'
import SelectionMenu from './SelectionMenu.vue'

const dialogStore = useDialogStore()
const systemStore = useSystemStore()

const messagesContainerRef = ref<HTMLElement>()
const userInput = ref('')
const selectedItems = ref<Array<{ id: string; type: string; label: string }>>([])
const showMenu = ref(false)

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

function sendUserMessage() {
  if (!userInput.value.trim()) return

  dialogStore.addUserMessage(userInput.value)
  userInput.value = ''
  selectedItems.value = []
}

function showCluesList() {
  // 显示线索列表
  console.log('显示线索列表')
}

function showSelectionMenu() {
  showMenu.value = true
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

function handleActionConfirm(messageId: string, actionPlanId: string) {
  // 处理操作确认
  console.log('确认操作', messageId, actionPlanId)
}

function handleActionCancel(messageId: string) {
  // 处理操作取消
  console.log('取消操作', messageId)
}

function handleActionModify(messageId: string, modifiedCmd: string) {
  // 处理命令修改
  console.log('修改命令', messageId, modifiedCmd)
}
</script>

<style scoped>
.glass {
  background: rgba(20, 22, 32, 0.95);
}
</style>

