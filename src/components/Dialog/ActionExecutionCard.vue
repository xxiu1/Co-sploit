<template>
  <div class="action-execution-card rounded-lg border p-3" :class="statusClass">
    <!-- 顶部：当前节点 + 状态时间 -->
    <div class="flex items-start justify-between gap-2 mb-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 text-gray-400 text-xs mb-1">
          <i class="fas fa-map-marker-alt text-purple-400"></i>
          <span>当前节点: {{ nodeName || `Task-${data.task_id}` }}</span>
        </div>
        <p v-if="nodeName" class="text-xs text-gray-500 line-clamp-2">{{ nodeName }}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span
          v-if="data.status === 'executing'"
          class="text-xs px-2 py-1 rounded bg-yellow-900/50 text-yellow-300"
        >
          <i class="fas fa-spinner fa-spin mr-1"></i>执行中
        </span>
        <span
          v-else-if="data.status === 'success'"
          class="text-xs px-2 py-1 rounded bg-green-900/50 text-green-300"
        >
          <i class="fas fa-check-circle mr-1"></i>执行成功
        </span>
        <span
          v-else
          class="text-xs px-2 py-1 rounded bg-red-900/50 text-red-300"
        >
          <i class="fas fa-times-circle mr-1"></i>执行失败
        </span>
        <span class="text-xs text-gray-500 whitespace-nowrap">
          {{ data.status === 'executing' ? (data.started_at || timeLabel) : (data.finished_at || timeLabel) }}
        </span>
      </div>
    </div>

    <!-- 命令 -->
    <div class="mb-3">
      <div class="text-xs text-gray-400 mb-1">
        <i class="fas fa-terminal mr-1"></i>命令
      </div>
      <div class="bg-gray-900/80 p-2 rounded font-mono text-xs text-emerald-300 break-all">
        {{ data.command }}
      </div>
    </div>

    <!-- 风险分析（LLM 富化后的说明）；无则占位 -->
    <div class="mb-3 p-2 rounded bg-blue-900/20 border border-blue-700/50 text-xs text-blue-200">
      <div class="flex flex-wrap gap-1">
        <strong>风险分析:</strong>
        <span v-if="data.risk_brief">{{ data.risk_brief }}</span>
        <span v-else class="text-gray-500">暂无风险分析</span>
      </div>
    </div>

    <!-- 执行中 -->
    <div v-if="data.status === 'executing'" class="flex items-center gap-2 text-yellow-400 text-sm py-2">
      <i class="fas fa-spinner fa-spin"></i>
      <span>执行中...</span>
    </div>

    <!-- 失败：仅一块「失败原因与分析」（结论 + LLM 分析），可展开原始日志 -->
    <template v-else-if="data.status === 'failed'">
      <div class="mb-3 p-2 rounded bg-red-900/20 border border-red-700/50 text-xs text-red-200">
        <div class="flex items-center justify-between gap-2 mb-1">
          <strong class="text-red-300">失败原因与分析</strong>
          <button
            v-if="hasRawLog"
            type="button"
            class="text-[10px] text-gray-500 hover:text-gray-300"
            @click="showRawLog = !showRawLog"
          >
            {{ showRawLog ? '收起原始日志' : '查看原始日志' }}
          </button>
        </div>
        <p class="whitespace-pre-wrap">{{ failureText }}</p>
        <div v-if="hasRawLog && showRawLog" class="mt-2 p-2 rounded bg-black/40 border border-gray-700 text-[10px] text-gray-400 font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
          {{ rawLogDisplay }}
        </div>
      </div>
      <div v-if="suggestionsList.length" class="mb-2 p-2 rounded bg-gray-800/50 border border-gray-600 text-xs text-gray-300">
        <div class="flex items-center gap-1 mb-1">
          <i class="fas fa-lightbulb text-yellow-400"></i>
          <strong>建议的后续操作</strong>
        </div>
        <ul class="list-disc list-inside space-y-0.5">
          <li v-for="(s, i) in suggestionsList" :key="i">{{ s }}</li>
        </ul>
      </div>
    </template>

    <!-- 成功：结果分析（LLM）+ 可展开原始日志 -->
    <div v-else-if="data.status === 'success' && (llmAnalyze || hasRawLog)" class="mb-3">
      <div v-if="llmAnalyze" class="mb-2 p-2 rounded bg-gray-800/50 border border-gray-600 text-xs text-gray-300">
        <div class="flex items-center justify-between gap-2 mb-1">
          <strong class="text-cyan-300">结果分析</strong>
          <button
            v-if="hasRawLog"
            type="button"
            class="text-[10px] text-gray-500 hover:text-gray-300"
            @click="showRawLog = !showRawLog"
          >
            {{ showRawLog ? '收起原始日志' : '查看原始日志' }}
          </button>
        </div>
        <p class="whitespace-pre-wrap">{{ llmAnalyze }}</p>
      </div>
      <div v-if="hasRawLog && showRawLog" class="p-2 rounded bg-black/40 border border-gray-700 text-[10px] text-gray-400 font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-all">
        {{ rawLogDisplay }}
      </div>
      <div v-else-if="hasRawLog && !llmAnalyze" class="p-2 rounded bg-gray-800/30 text-xs text-gray-500">
        <button type="button" class="text-cyan-400 hover:underline" @click="showRawLog = !showRawLog">
          {{ showRawLog ? '收起原始日志' : '查看原始日志' }}
        </button>
        <div v-if="showRawLog" class="mt-2 p-2 rounded bg-black/40 font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-all text-gray-400">
          {{ rawLogDisplay }}
        </div>
      </div>
    </div>

    <!-- 底部：风险得分 + 预计时间（仅一处） -->
    <div class="mt-3 pt-2 border-t border-dark-border flex flex-wrap gap-4 text-xs text-gray-400">
      <span v-if="riskDisplayScore != null">风险得分: {{ riskLabel }} ({{ riskDisplayScore }}/10)</span>
      <span>预计时间: {{ data.estimated_time || '—' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ActionExecutionMessageData } from '@/types'

const props = defineProps<{
  data: ActionExecutionMessageData
  nodeName?: string
}>()

const showRawLog = ref(false)

/** 从 analyze_context 解析出 [RAW] 与 [LLM] 两段，格式： [RAW]\n...\n[LLM]\n... */
function parseAnalyzeContext(ctx: string | undefined): { raw: string; llm: string } {
  if (!ctx || !ctx.trim()) return { raw: '', llm: '' }
  const s = ctx.trim()
  const llmSep = '\n[LLM]\n'
  const idx = s.indexOf(llmSep)
  if (idx >= 0) {
    const rawPart = s.slice(0, idx)
    const raw = rawPart.startsWith('[RAW]\n') ? rawPart.slice(6) : rawPart
    const llm = s.slice(idx + llmSep.length).trim()
    return { raw, llm }
  }
  if (s.startsWith('[RAW]\n')) return { raw: s.slice(6), llm: '' }
  return { raw: '', llm: '' }
}

const parsedContext = computed(() => parseAnalyzeContext(props.data.analyze_context))
const rawLog = computed(() => parsedContext.value.raw)
const llmAnalyze = computed(() => parsedContext.value.llm)
/** 有 [RAW] 段即显示「查看原始日志」入口；展开后无内容时显示占位提示 */
const hasRawLog = computed(() => (props.data.analyze_context || '').includes('[RAW]'))
const rawLogDisplay = computed(() => rawLog.value || '（无标准输出或已重定向到文件）')

const timeLabel = computed(() => {
  return props.data.started_at || props.data.finished_at || ''
})

const statusClass = computed(() => {
  switch (props.data.status) {
    case 'executing':
      return 'border-yellow-500/50 bg-yellow-900/5'
    case 'success':
      return 'border-green-500/30 bg-green-900/5'
    case 'failed':
      return 'border-red-500/30 bg-red-900/5'
    default:
      return 'border-gray-700'
  }
})

/** 后端风险为 1–10 分制，直接展示 */
const riskDisplayScore = computed(() => {
  const s = props.data.risk_score
  if (s == null) return null
  if (s >= 1 && s <= 10) return Math.round(s)
  return Math.min(10, Math.round(s / 10))
})

const riskLabel = computed(() => {
  const s = props.data.risk_score
  if (s == null) return '—'
  const score = s >= 1 && s <= 10 ? s : s / 10
  if (score >= 8) return '高'
  if (score >= 5) return '中'
  return '低'
})

/** 失败时仅展示 LLM 分析（analyze_context 的 [LLM] 段），无则为空或「暂无分析」 */
const failureText = computed(() => {
  if (props.data.status !== 'failed') return ''
  return llmAnalyze.value || '暂无分析'
})

const suggestionsList = computed(() => {
  if (props.data.suggestions?.length) return props.data.suggestions
  if (props.data.result?.suggestions?.length) return props.data.result.suggestions
  return []
})
</script>

<style scoped>
.action-execution-card {
  @apply border-dark-border;
}
</style>
