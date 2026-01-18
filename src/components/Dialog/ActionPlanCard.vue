<template>
  <div class="action-plan-card" :class="statusClass">
    <!-- 操作计划标题 -->
    <div class="flex items-center justify-between mb-2">
      <h4 class="font-bold text-white">{{ plan.title }}</h4>
      <span class="text-xs px-2 py-1 rounded" :class="riskClass">
        {{ plan.risk }}
      </span>
    </div>

    <!-- 工具和命令 -->
    <div class="mb-2">
      <div class="text-xs text-gray-400 mb-1">
        <i class="fas fa-toolbox mr-1"></i>{{ plan.tool }}
      </div>
      <div class="bg-gray-900 p-2 rounded font-mono text-xs text-gray-300">
        {{ plan.cmd }}
      </div>
    </div>

    <!-- 预测结果（如果存在） -->
    <div v-if="prediction" class="mb-2 p-2 bg-blue-900/20 border border-blue-700/50 rounded text-xs text-blue-300">
      <i class="fas fa-lightbulb mr-1"></i>
      <strong>预测结果:</strong> {{ prediction }}
    </div>

    <!-- 执行结果（如果存在） -->
    <div v-if="result" class="mb-2">
      <div class="p-2 rounded text-xs" :class="result.success ? 'bg-green-900/20 border border-green-700/50 text-green-300' : 'bg-red-900/20 border border-red-700/50 text-red-300'">
        <div class="flex items-center gap-1 mb-1">
          <i :class="result.success ? 'fas fa-check-circle' : 'fas fa-times-circle'"></i>
          <strong>{{ result.success ? '执行成功' : '执行失败' }}</strong>
        </div>
        <p v-if="result.message">{{ result.message }}</p>
        <div v-if="result.analysis" class="mt-2 text-gray-400">
          <strong>分析:</strong> {{ result.analysis }}
        </div>
        <div v-if="result.suggestions && result.suggestions.length > 0" class="mt-2">
          <strong>建议:</strong>
          <ul class="list-disc list-inside mt-1">
            <li v-for="(suggestion, index) in result.suggestions" :key="index">
              {{ suggestion }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div v-if="status === 'pending'" class="flex gap-2 mt-3">
      <button
        @click="handleConfirm"
        class="flex-1 bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded text-sm font-bold transition-colors"
      >
        <i class="fas fa-check mr-1"></i>确认执行
      </button>
      <button
        @click="showModifyDialog = true"
        class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded text-sm font-bold transition-colors"
      >
        <i class="fas fa-edit mr-1"></i>修改
      </button>
      <button
        @click="handleCancel"
        class="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded text-sm font-bold transition-colors"
      >
        <i class="fas fa-times mr-1"></i>取消
      </button>
    </div>

    <!-- 执行中状态 -->
    <div v-else-if="status === 'executing'" class="mt-3 flex items-center gap-2 text-yellow-400">
      <i class="fas fa-spinner fa-spin"></i>
      <span class="text-sm">执行中...</span>
    </div>

    <!-- 修改命令对话框 -->
    <div
      v-if="showModifyDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showModifyDialog = false"
    >
      <div class="bg-dark-panel border border-dark-border rounded-lg p-4 w-96">
        <h5 class="font-bold text-white mb-2">修改命令</h5>
        <textarea
          v-model="modifiedCmd"
          class="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white font-mono mb-3"
          rows="4"
        ></textarea>
        <div class="flex gap-2 justify-end">
          <button
            @click="showModifyDialog = false"
            class="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded text-sm"
          >
            取消
          </button>
          <button
            @click="handleModify"
            class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm"
          >
            确认修改
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ActionPlan, ExecutionResult } from '@/types'
import { getRiskColor } from '@/utils'

interface Props {
  plan: ActionPlan
  status: 'pending' | 'executing' | 'success' | 'failed'
  result?: ExecutionResult
  prediction?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  confirm: [actionPlanId: string]
  cancel: []
  modify: [modifiedCmd: string]
}>()

const showModifyDialog = ref(false)
const modifiedCmd = ref(props.plan.cmd)

const statusClass = computed(() => {
  switch (props.status) {
    case 'executing':
      return 'border-yellow-500/50 bg-yellow-900/10'
    case 'success':
      return 'border-green-500/50 bg-green-900/10'
    case 'failed':
      return 'border-red-500/50 bg-red-900/10'
    default:
      return 'border-gray-700'
  }
})

const riskClass = computed(() => {
  switch (props.plan.risk) {
    case 'Low':
      return 'bg-green-900/50 text-green-300'
    case 'Moderate':
      return 'bg-yellow-900/50 text-yellow-300'
    case 'High':
      return 'bg-red-900/50 text-red-300'
    default:
      return 'bg-gray-800 text-gray-300'
  }
})

function handleConfirm() {
  emit('confirm', props.plan.id)
}

function handleCancel() {
  emit('cancel')
}

function handleModify() {
  emit('modify', modifiedCmd.value)
  showModifyDialog.value = false
}
</script>

<style scoped>
.action-plan-card {
  @apply p-3 rounded-lg border;
}
</style>

