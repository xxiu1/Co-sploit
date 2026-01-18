<template>
  <div
    class="terminal-panel bg-[#0a0c10] border-t border-dark-border flex flex-col shrink-0 z-40 transition-all duration-300"
    :class="{ 'h-48': !isCollapsed, 'h-8': isCollapsed }"
  >
    <!-- 头部 -->
    <div
      class="h-8 bg-[#11131a] border-b border-dark-border flex items-center px-4 justify-between shrink-0"
    >
      <span class="text-xs font-bold text-gray-400">TERMINAL SESSION 1</span>
      <div class="flex items-center gap-2">
        <button
          @click="toggleCollapse"
          class="text-[10px] px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center gap-1 transition-colors"
        >
          <i :class="isCollapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down'"></i>
          <span>{{ isCollapsed ? '展开' : '收起' }}</span>
        </button>
        <div class="flex gap-2 ml-2">
          <div class="w-3 h-3 rounded-full bg-red-500/20"></div>
          <div class="w-3 h-3 rounded-full bg-yellow-500/20"></div>
          <div class="w-3 h-3 rounded-full bg-green-500/20"></div>
        </div>
      </div>
    </div>

    <!-- 终端内容 -->
    <div
      v-if="!isCollapsed"
      ref="terminalContentRef"
      class="flex-1 p-3 font-mono text-xs overflow-y-auto text-gray-300"
    >
      <div v-for="(line, index) in lines" :key="index" class="terminal-line">
        <span v-if="line.type === 'command'" class="text-green-500">root@kali</span>:$
        <span class="ml-1">{{ line.content }}</span>
      </div>
      <div v-if="showCursor" class="terminal-line">
        <span class="text-green-500">root@kali</span>:$
        <span class="typing ml-1"></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'

interface TerminalLine {
  type: 'command' | 'output' | 'error'
  content: string
  timestamp?: string
}

interface Props {
  lines?: TerminalLine[]
  showCursor?: boolean
  autoScroll?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  lines: () => [],
  showCursor: true,
  autoScroll: true,
})

const terminalContentRef = ref<HTMLElement>()
const isCollapsed = ref(false)

// 监听 lines 变化，自动滚动
watch(
  () => props.lines.length,
  async () => {
    if (props.autoScroll && !isCollapsed.value) {
      await nextTick()
      scrollToBottom()
    }
  }
)

function scrollToBottom() {
  if (terminalContentRef.value) {
    terminalContentRef.value.scrollTop = terminalContentRef.value.scrollHeight
  }
}

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
  if (!isCollapsed.value && props.autoScroll) {
    nextTick(() => {
      scrollToBottom()
    })
  }
}

onMounted(() => {
  if (props.autoScroll) {
    scrollToBottom()
  }
})
</script>

<style scoped>
.terminal-line {
  @apply mb-1;
}

.typing::after {
  content: '▋';
  animation: blink 1s infinite;
  color: #a855f7;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}
</style>

