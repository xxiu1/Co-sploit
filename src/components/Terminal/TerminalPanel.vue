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
          v-if="systemStore.isRunning || systemStore.isPausing || systemStore.isPaused"
          @click="onStopExecution"
          class="text-[10px] px-2 py-0.5 rounded bg-red-900 hover:bg-red-800 text-red-300 flex items-center gap-1 transition-colors"
          title="结束执行并保存输出日志"
        >
          <i class="fas fa-stop"></i>
          <span>结束执行</span>
        </button>
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
      ref="terminalContainerRef"
      class="flex-1 terminal-container"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { wsManager } from '@/utils/websocket'
import { useSystemStore } from '@/stores/system'

const systemStore = useSystemStore()
const emit = defineEmits<{ (e: 'stop'): void }>()

function onStopExecution() {
  emit('stop')
}

interface Props {
  autoScroll?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoScroll: true,
})

const terminalContainerRef = ref<HTMLElement>()
const isCollapsed = ref(false)
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let isTerminalConnected = false

// 处理终端输出的回调函数（用于 WebSocket 监听）
const handleTerminalOutput = (data: { output: string }) => {
  if (terminal) {
    terminal.write(data.output)
  }
}

// 处理系统命令输出的回调函数（用于显示系统自动执行的命令）
const handleSystemCommandOutput = (data: { command: string; output: string }) => {
  if (terminal) {
    // 显示系统执行的命令（带标记）
    terminal.write(`\r\n\x1b[33m[System] Executing: ${data.command}\x1b[0m\r\n`)
    // 显示命令输出
    terminal.write(data.output)
  }
}

// 初始化终端
function initTerminal() {
  if (!terminalContainerRef.value) return

  // 创建终端实例
  terminal = new Terminal({
    theme: {
      background: '#0a0c10',
      foreground: '#e5e7eb',
      cursor: '#a855f7',
      cursorAccent: '#a855f7',
      selection: 'rgba(168, 85, 247, 0.3)',
      black: '#000000',
      red: '#ef4444',
      green: '#22c55e',
      yellow: '#fbbf24',
      blue: '#3b82f6',
      magenta: '#a855f7',
      cyan: '#06b6d4',
      white: '#e5e7eb',
      brightBlack: '#6b7280',
      brightRed: '#f87171',
      brightGreen: '#4ade80',
      brightYellow: '#facc15',
      brightBlue: '#60a5fa',
      brightMagenta: '#c084fc',
      brightCyan: '#67e8f9',
      brightWhite: '#ffffff',
    },
    fontSize: 12,
    fontFamily: "'Courier New', 'Courier', monospace",
    cursorBlink: true,
    cursorStyle: 'block',
    scrollback: 10000,
    allowTransparency: true,
    convertEol: true, // 转换换行符
  })

  // 添加插件
  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(new WebLinksAddon())

  // 打开终端
  terminal.open(terminalContainerRef.value)

  // 适应容器大小
  fitAddon.fit()

  // 监听终端输入（用户按键）
  terminal.onData((data: string) => {
    handleUserInput(data)
  })

  // 监听 WebSocket 消息
  setupWebSocketListeners()

  // 连接终端会话
  connectTerminalSession()
}

// 设置 WebSocket 监听
function setupWebSocketListeners() {
  // 监听终端输出（真实 shell 的输出）
  wsManager.on('terminal_output', handleTerminalOutput)

  // 监听系统命令输出（系统自动执行的命令）
  wsManager.on('system_command_output', handleSystemCommandOutput)

  // 监听终端连接状态
  wsManager.on('terminal_connected', () => {
    isTerminalConnected = true
    if (terminal) {
      terminal.write('\r\n\x1b[32mTerminal session connected\x1b[0m\r\n')
    }
  })

  wsManager.on('terminal_disconnected', () => {
    isTerminalConnected = false
    if (terminal) {
      terminal.write('\r\n\x1b[31mTerminal session disconnected\x1b[0m\r\n')
    }
  })
}

// 连接终端会话
function connectTerminalSession() {
  // 通过 WebSocket 请求连接终端会话
  wsManager.send({
    type: 'terminal_connect',
  })

  // 显示等待连接信息
  if (terminal) {
    terminal.write('\x1b[33mConnecting to terminal session...\x1b[0m\r\n')
  }
}

// 处理用户输入
function handleUserInput(data: string) {
  if (!terminal || !isTerminalConnected) {
    // 如果终端未连接，不处理输入
    return
  }

  // 将用户输入发送到后端终端会话
  // 这里直接发送原始数据，包括特殊字符（Ctrl+C、方向键等）
  wsManager.send({
    type: 'terminal_input',
    data: data, // 原始输入数据，包括所有控制字符
  })
}

// 写入输出（供外部调用，用于显示系统消息等）
function writeOutput(text: string) {
  if (terminal) {
    terminal.write(text)
  }
}

// 写入命令（供外部调用，用于显示系统执行的命令）
function writeCommand(command: string) {
  if (terminal) {
    terminal.write(`\r\n\x1b[33m[System] ${command}\x1b[0m\r\n`)
  }
}

// 清屏
function clearTerminal() {
  if (terminal) {
    terminal.clear()
  }
}

// 写入提示符（供外部调用）
function writePrompt() {
  // 提示符由后端终端会话控制，不需要前端手动写入
}

// 切换折叠状态
function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
  if (!isCollapsed.value && fitAddon) {
    nextTick(() => {
      fitAddon?.fit()
    })
  }
}

// 监听窗口大小变化
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  initTerminal()

  // 监听容器大小变化
  if (terminalContainerRef.value && fitAddon) {
    resizeObserver = new ResizeObserver(() => {
      if (!isCollapsed.value && fitAddon) {
        fitAddon.fit()
      }
    })
    resizeObserver.observe(terminalContainerRef.value)
  }
})

onUnmounted(() => {
  // 断开终端会话
  if (isTerminalConnected) {
    wsManager.send({
      type: 'terminal_disconnect',
    })
  }

  // 移除 WebSocket 监听
  wsManager.off('terminal_output', handleTerminalOutput)
  wsManager.off('system_command_output', handleSystemCommandOutput)

  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  if (terminal) {
    terminal.dispose()
  }
})

// 监听折叠状态变化，重新适应大小
watch(isCollapsed, (newVal) => {
  if (!newVal && fitAddon) {
    nextTick(() => {
      fitAddon?.fit()
    })
  }
})

// 暴露方法供外部调用
defineExpose({
  writeOutput,
  writeCommand,
  clearTerminal,
  writePrompt,
})
</script>

<style scoped>
.terminal-container {
  padding: 0.75rem;
  overflow: hidden;
}

/* xterm.js 样式覆盖 */
:deep(.xterm) {
  height: 100%;
  width: 100%;
}

:deep(.xterm-viewport) {
  background-color: transparent !important;
}
</style>

