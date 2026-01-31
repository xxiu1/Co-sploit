<template>
  <div class="dialog-message" :class="messageClass">
    <!-- 系统消息 -->
    <div v-if="message.type === 'system'" class="flex items-start gap-2">
      <i class="fas fa-info-circle text-blue-400 mt-1"></i>
      <div class="flex-1">
        <p class="text-sm text-gray-300">{{ message.content }}</p>
        <span class="text-xs text-gray-500">{{ formattedTimestamp }}</span>
      </div>
    </div>

    <!-- 操作消息 -->
    <div v-else-if="message.type === 'action' && message.actionData" class="action-message">
      <ActionPlanCard
        :plan="message.actionData.plan"
        :status="message.actionData.status"
        :result="message.actionData.result"
        :prediction="message.actionData.prediction"
        @confirm="handleConfirm"
        @cancel="handleCancel"
        @modify="handleModify"
      />
      <span class="text-xs text-gray-500 mt-1 block">{{ formattedTimestamp }}</span>
    </div>

    <!-- 实时执行 action 卡片（执行完保留为历史） -->
    <div v-else-if="message.type === 'action_execution' && message.actionExecutionData" class="action-execution-message">
      <ActionExecutionCard
        :data="message.actionExecutionData"
        :node-name="executionNodeName"
      />
      <span class="text-xs text-gray-500 mt-1 block">{{ formattedTimestamp }}</span>
    </div>

    <!-- 用户消息 -->
    <div v-else-if="message.type === 'user'" class="flex items-start gap-2">
      <i class="fas fa-user text-purple-400 mt-1"></i>
      <div class="flex-1">
        <p class="text-sm text-white">{{ message.content }}</p>
        <span class="text-xs text-gray-500">{{ formattedTimestamp }}</span>
      </div>
    </div>

    <!-- 成功消息 -->
    <div v-else-if="message.type === 'success'" class="flex items-start gap-2">
      <i class="fas fa-check-circle text-green-400 mt-1"></i>
      <div class="flex-1">
        <p class="text-sm text-green-300">{{ message.content }}</p>
        <span class="text-xs text-gray-500">{{ formattedTimestamp }}</span>
      </div>
    </div>

    <!-- 错误消息 -->
    <div v-else-if="message.type === 'error'" class="flex items-start gap-2">
      <i class="fas fa-exclamation-circle text-red-400 mt-1"></i>
      <div class="flex-1">
        <p class="text-sm text-red-300">{{ message.content }}</p>
        <span class="text-xs text-gray-500">{{ formattedTimestamp }}</span>
      </div>
    </div>

    <!-- 警告消息 -->
    <div v-else-if="message.type === 'warning'" class="flex items-start gap-2">
      <i class="fas fa-exclamation-triangle text-yellow-400 mt-1"></i>
      <div class="flex-1">
        <p class="text-sm text-yellow-300">{{ message.content }}</p>
        <span class="text-xs text-gray-500">{{ formattedTimestamp }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DialogMessage } from '@/types'
import { formatTimestamp } from '@/utils'
import ActionPlanCard from './ActionPlanCard.vue'
import ActionExecutionCard from './ActionExecutionCard.vue'
import { useNodeStore } from '@/stores/node'

interface Props {
  message: DialogMessage
}

const props = defineProps<Props>()
const nodeStore = useNodeStore()

const executionNodeName = computed(() => {
  const tid = props.message.actionExecutionData?.task_id
  if (tid == null) return undefined
  const node = nodeStore.getNode(`task-${tid}`)
  return node?.title
})

const emit = defineEmits<{
  actionConfirm: [messageId: string, actionPlanId: string]
  actionCancel: [messageId: string]
  actionModify: [messageId: string, modifiedCmd: string]
}>()

const messageClass = computed(() => {
  return `message-${props.message.type}`
})

const formattedTimestamp = computed(() => {
  return formatTimestamp(props.message.timestamp)
})

function handleConfirm(actionPlanId: string) {
  emit('actionConfirm', props.message.id, actionPlanId)
}

function handleCancel() {
  emit('actionCancel', props.message.id)
}

function handleModify(modifiedCmd: string) {
  emit('actionModify', props.message.id, modifiedCmd)
}
</script>

<style scoped>
.dialog-message {
  @apply p-3 rounded-lg bg-dark-panel/50 border border-dark-border;
}

.message-system {
  @apply bg-blue-900/20 border-blue-700/50;
}

.message-success {
  @apply bg-green-900/20 border-green-700/50;
}

.message-error {
  @apply bg-red-900/20 border-red-700/50;
}

.message-warning {
  @apply bg-yellow-900/20 border-yellow-700/50;
}
</style>

