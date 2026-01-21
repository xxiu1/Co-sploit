<template>
  <div
    v-if="show"
    class="start-overlay absolute inset-0 bg-dark-bg/95 flex items-center justify-center z-50"
  >
    <div class="text-center w-full max-w-md px-6">
      <div class="text-4xl font-bold text-purple-500 mb-4">CO-SPLOIT</div>
      <div class="text-gray-400 mb-6">交互式渗透测试系统</div>

      <!-- 目标IP输入 -->
      <div class="mb-6 text-left">
        <label for="target-ip-input" class="block text-sm font-semibold text-gray-300 mb-2">
          <i class="fas fa-bullseye mr-2"></i>目标IP地址
        </label>
        <input
          id="target-ip-input"
          v-model="targetIP"
          type="text"
          placeholder="例如: 10.129.234.72"
          class="w-full bg-gray-900 border rounded-lg px-4 py-3 text-white text-center font-mono focus:outline-none focus:ring-2 transition-colors"
          :class="
            ipError
              ? 'border-red-500 ring-2 ring-red-500/50'
              : 'border-gray-700 focus:border-purple-500 focus:ring-purple-500/50'
          "
          @keypress.enter="handleStart"
          @input="handleIPInput"
        />
        <div v-if="ipError" class="mt-2 text-xs text-red-400 text-center">
          {{ ipError }}
        </div>
        <div v-else class="mt-2 text-xs text-gray-500 text-center">
          请输入要测试的目标IP地址
        </div>
      </div>

      <button
        :disabled="isStarting || !isValidIP"
        @click="handleStart"
        class="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-8 py-4 rounded-lg text-lg font-bold shadow-lg shadow-purple-900/30 flex items-center gap-3 mx-auto transition-transform active:scale-95 disabled:active:scale-100"
      >
        <i v-if="isStarting" class="fas fa-spinner fa-spin"></i>
        <i v-else class="fas fa-rocket"></i>
        <span>{{ isStarting ? '启动中...' : '开始自动化渗透测试' }}</span>
      </button>
      <div class="mt-4 text-xs text-gray-500">
        系统将自动执行低风险操作，遇到高风险操作时将暂停等待审核
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { isValidIP } from '@/utils'

interface Props {
  show: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  start: [targetIP: string]
}>()

const targetIP = ref('10.129.234.72')
const ipError = ref('')
const isStarting = ref(false)

const isValidIPAddress = computed(() => {
  if (!targetIP.value.trim()) {
    return false
  }
  return isValidIP(targetIP.value.trim())
})

function handleIPInput() {
  ipError.value = ''
  if (targetIP.value.trim() && !isValidIP(targetIP.value.trim())) {
    ipError.value = 'IP地址格式不正确，请输入有效的IPv4地址（例如: 10.129.234.72）'
  }
}

async function handleStart() {
  const ip = targetIP.value.trim()

  // 验证IP
  if (!ip) {
    ipError.value = '请输入目标IP地址'
    return
  }

  if (!isValidIP(ip)) {
    ipError.value = 'IP地址格式不正确，请输入有效的IPv4地址（例如: 10.129.234.72）'
    return
  }

  isStarting.value = true
  ipError.value = ''

  try {
    emit('start', ip)
  } catch (error) {
    console.error('启动失败:', error)
    ipError.value = '启动失败，请重试'
  } finally {
    isStarting.value = false
  }
}
</script>

<style scoped>
.start-overlay {
  backdrop-filter: blur(4px);
}
</style>

