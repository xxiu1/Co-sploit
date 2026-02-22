<template>
  <!-- 使用原生 HTML 对话框 -->
  <div v-if="visible" class="dialog-overlay" @click.self="handleClose">
    <div class="dialog-container" @click.stop>
      <div class="dialog-header">
        <h2 class="dialog-title">
          {{ node ? `节点详情: ${node.title}` : '节点详情' }}
        </h2>
        <button class="dialog-close" @click="handleClose">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="dialog-body">
        <div v-if="node" class="node-detail">
          <!-- 任务描述（仅任务节点，来自 task_description 字段） -->
          <div v-if="(node.type === 'task' || node.metadata?.task_id != null) && (node.metadata?.task_description ?? '')" class="info-card card-summary">
            <div class="card-header">
              <div class="card-icon summary-icon">
                <i class="fas fa-align-left"></i>
              </div>
              <h3 class="card-title">任务描述</h3>
            </div>
            <div class="card-content">
              <p class="summary-text">{{ node.metadata?.task_description ?? '' }}</p>
            </div>
          </div>

          <!-- Node_Status: 节点状态 - 卡片式布局 -->
          <div class="info-card card-status">
            <div class="card-header">
              <div class="card-icon status-icon">
                <i class="fas fa-info-circle"></i>
              </div>
              <h3 class="card-title">节点状态</h3>
            </div>
            <div class="card-content">
              <div class="status-badge-large" :class="getStatusTagClass(node.status)">
                <i :class="getStatusIcon(node.status)"></i>
                <span class="status-text">{{ getStatusText(node.status) }}</span>
              </div>
              <div v-if="node.metadata?.node_status" class="status-meta">
                <span class="meta-label">详细状态:</span>
                <span class="meta-value">{{ node.metadata.node_status }}</span>
              </div>
            </div>
          </div>

          <!-- State_Context: 环境上下文 - 卡片式布局 -->
          <div class="info-card card-context">
            <div class="card-header">
              <div class="card-icon context-icon">
                <i class="fas fa-file-alt"></i>
              </div>
              <h3 class="card-title">环境上下文</h3>
            </div>
            <div class="card-content">
              <div class="collapse-wrapper">
                <button 
                  class="collapse-button-modern" 
                  @click="showContext = !showContext"
                >
                  <span class="collapse-label">查看完整日志</span>
                  <i class="fas transition-icon" :class="showContext ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                </button>
                <transition name="slide-fade">
                  <div v-if="showContext" class="log-content-modern">
                    <div class="log-header">
                      <i class="fas fa-code"></i>
                      <span>日志内容</span>
                    </div>
                    <pre class="log-text">{{ node.metadata?.state_context || '暂无日志' }}</pre>
                  </div>
                </transition>
              </div>
            </div>
          </div>

          <!-- History_Actions: 历史操作（含本任务实时） - 卡片式布局 -->
          <div class="info-card card-actions">
            <div class="card-header">
              <div class="card-icon actions-icon">
                <i class="fas fa-history"></i>
              </div>
              <h3 class="card-title">历史操作</h3>
              <span v-if="historyActions.length > 0" class="card-badge">{{ historyActions.length }}</span>
            </div>
            <div class="card-content">
              <!-- 本任务正在执行的操作（实时） -->
              <div v-if="executingForTask.length > 0" class="executing-for-task-block mb-3">
                <div class="flex items-center gap-2 mb-2">
                  <i class="fas fa-spinner fa-spin text-yellow-400 text-xs"></i>
                  <span class="text-xs font-medium text-yellow-300">本任务正在执行</span>
                  <span class="text-[10px] bg-yellow-900/50 text-yellow-300 px-1.5 py-0.5 rounded">{{ executingForTask.length }}</span>
                </div>
                <div class="space-y-1.5">
                  <div
                    v-for="a in executingForTask"
                    :key="a.action_id"
                    class="executing-mini-row"
                  >
                    <div class="executing-mini-left">
                      <i class="fas fa-terminal text-yellow-400 text-[10px] mr-1.5"></i>
                      <code class="text-[11px] text-yellow-200 break-all">{{ a.command }}</code>
                      <span v-if="a.risk_score != null" class="ml-2 text-[10px] px-1.5 py-0.5 rounded font-semibold" :class="getRiskScoreClass(a.risk_score)">{{ a.risk_score }}</span>
                    </div>
                    <span v-if="a.executed_at ?? a.timestamp" class="executing-mini-time text-[10px] text-gray-500 whitespace-nowrap">{{ a.executed_at ?? a.timestamp }}</span>
                  </div>
                </div>
              </div>
              <div v-if="historyActions && historyActions.length > 0" class="actions-timeline-modern">
                <div 
                  v-for="(action, index) in historyActions" 
                  :key="action.action_id ?? action.id ?? index"
                  class="timeline-item-modern"
                >
                  <div class="timeline-marker-modern" :class="getResultMarkerClass(action.result)">
                    <i :class="getActionIcon(action.command)"></i>
                  </div>
                  <div class="timeline-content-modern">
                    <div class="action-card">
                      <div class="action-header-modern">
                        <div class="action-title-group">
                          <i class="fas fa-terminal action-icon"></i>
                          <strong class="action-command-modern">{{ action.command }}</strong>
                        </div>
                      </div>
                      <div v-if="action.parameters" class="action-params-modern">
                        <span class="params-label">参数:</span>
                        <code class="params-value">{{ action.parameters }}</code>
                      </div>
                      <div class="action-result-modern">
                        <span class="result-label">结果:</span>
                        <span class="result-badge" :class="getResultColorClass(action.result)">
                          <i :class="getResultIcon(action.result)"></i>
                          {{ action.result }}
                        </span>
                        <span v-if="action.result_detail" class="result-detail-modern">
                          {{ action.result_detail }}
                        </span>
                      </div>
                      <div v-if="(action.output ?? action.analyze_context) || getAnalyzeLlm(action).length" class="action-output-modern">
                        <div class="output-header flex items-center justify-between gap-2">
                          <span><i class="fas fa-file-code"></i> {{ getAnalyzeLlm(action) ? '结果分析' : '输出' }}</span>
                          <button
                            v-if="getAnalyzeRaw(action).length"
                            type="button"
                            class="text-[10px] text-gray-500 hover:text-gray-300"
                            @click="toggleRawForAction(action.action_id)"
                          >
                            {{ expandedRawActionId === action.action_id ? '收起原始日志' : '查看原始日志' }}
                          </button>
                        </div>
                        <div v-if="getAnalyzeLlm(action)" class="output-content output-llm">{{ getAnalyzeLlm(action) }}</div>
                        <div v-else class="output-content">{{ action.output ?? action.analyze_context }}</div>
                        <div v-if="getAnalyzeRaw(action).length && expandedRawActionId === action.action_id" class="output-content output-raw mt-2">{{ getAnalyzeRaw(action) }}</div>
                      </div>
                      <div v-if="action.risk_score != null" class="action-risk-modern mt-1">
                        <span class="text-gray-400 text-[10px]">风险得分</span>
                        <span
                          class="ml-1 px-2 py-0.5 rounded text-xs font-semibold"
                          :class="getRiskScoreClass(action.risk_score)"
                        >
                          {{ action.risk_score }}
                        </span>
                      </div>
                      <div v-if="action.executed_at ?? action.timestamp" class="action-card-footer">
                        <span class="action-timestamp-modern">
                          <i class="fas fa-clock"></i>
                          {{ action.executed_at ?? action.timestamp }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="empty-state-modern">
                <i class="fas fa-inbox"></i>
                <p>暂无历史操作记录</p>
              </div>
            </div>
          </div>

          <!-- Action_Plans: 操作计划 - 卡片式布局 -->
          <div class="info-card card-plans">
            <div class="card-header">
              <div class="card-icon plans-icon">
                <i class="fas fa-tasks"></i>
              </div>
              <h3 class="card-title">操作计划</h3>
              <span v-if="actionPlans.length > 0" class="card-badge">{{ actionPlans.length }}</span>
            </div>
            <div class="card-content">
              <div v-if="actionPlans && actionPlans.length > 0" class="action-plans-grid">
                <div 
                  v-for="plan in actionPlans" 
                  :key="plan.task_id"
                  class="plan-card"
                >
                  <div class="plan-card-header">
                    <span 
                      class="plan-status-badge" 
                      :style="{ backgroundColor: getStatusColor(plan.status_color) }"
                    >
                      <i :class="getStatusIcon(plan.status)"></i>
                      {{ getStatusText(plan.status) }}
                    </span>
                    <span class="plan-name-modern">{{ plan.task_name }}</span>
                  </div>
                  <div v-if="plan.task_description" class="plan-summary-modern">
                    <i class="fas fa-info-circle"></i>
                    {{ plan.task_description }}
                  </div>
                </div>
              </div>
              <div v-else class="empty-state-modern">
                <i class="fas fa-clipboard-list"></i>
                <p>暂无操作计划</p>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="loading-state-modern">
          <i class="fas fa-spinner fa-spin"></i>
          <p>节点数据加载中...</p>
        </div>
      </div>

      <div class="dialog-footer">
        <button class="btn-close" @click="handleClose">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, onUnmounted } from 'vue'
import { useActionStore } from '@/stores'
import type { Node } from '@/types'

interface Props {
  modelValue: boolean
  node: Node | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const actionStore = useActionStore()
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const showContext = ref(false)
/** 当前展开「查看原始日志」的 action_id */
const expandedRawActionId = ref<number | null>(null)

/** 从 analyze_context 解析 [RAW] 与 [LLM] 两段，格式： [RAW]\n...\n[LLM]\n... */
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

function getAnalyzeLlm(action: { analyze_context?: string }): string {
  return parseAnalyzeContext(action.analyze_context).llm
}

function getAnalyzeRaw(action: { analyze_context?: string }): string {
  return parseAnalyzeContext(action.analyze_context).raw
}

function toggleRawForAction(id: number) {
  expandedRawActionId.value = expandedRawActionId.value === id ? null : id
}

/** 任务节点 ID（仅任务节点有） */
const taskId = computed(() => {
  const id = props.node?.metadata?.task_id
  return typeof id === 'number' ? id : undefined
})

/** 来自 metadata 的历史操作（静态） */
const historyActionsFromMeta = computed(() => props.node?.metadata?.history_actions || [])

/** 展示用历史操作：任务节点优先用 store 实时数据，否则用 metadata */
const historyActions = computed(() => {
  const tid = taskId.value
  if (tid !== undefined) {
    const fromStore = actionStore.getActionsByTaskId(tid)
    if (fromStore.length > 0) return fromStore
  }
  return historyActionsFromMeta.value
})

/** 本任务下正在执行的 action（仅任务节点有） */
const executingForTask = computed(() => {
  const tid = taskId.value
  if (tid === undefined) return []
  return actionStore.getExecutingActionsByTaskId(tid)
})

const actionPlans = computed(() => props.node?.metadata?.action_plans || [])

// 打开任务节点时拉取该任务的 actions，并做短轮询
let refreshTimer: ReturnType<typeof setInterval> | null = null
watch(
  () => [props.node, props.modelValue] as const,
  ([newNode, modelValue]) => {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
    if (newNode && modelValue && taskId.value !== undefined) {
      actionStore.fetchActions({ task_id: taskId.value })
      actionStore.fetchExecutingActions()
      refreshTimer = setInterval(() => {
        if (props.modelValue && taskId.value !== undefined) {
          actionStore.fetchActions({ task_id: taskId.value })
          actionStore.fetchExecutingActions()
        }
      }, 5000)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})

function handleClose() {
  visible.value = false
  showContext.value = false
}

function getStatusTagClass(status: string): string {
  const map: Record<string, string> = {
    pending: 'status-info',
    executing: 'status-warning',
    success: 'status-success',
    failed: 'status-danger',
    in_progress: 'status-warning',
    completed: 'status-success',
  }
  return map[status] || 'status-info'
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: '待执行',
    executing: '执行中',
    success: '成功',
    failed: '失败',
    in_progress: '进行中',
    completed: '已完成',
  }
  return map[status] || status
}

function getResultColorClass(result: string): string {
  if (result === 'success') return 'text-success'
  if (result === 'failed') return 'text-danger'
  return 'text-gray-400'
}

function getResultMarkerClass(result: string): string {
  if (result === 'success') return 'marker-success'
  if (result === 'failed') return 'marker-danger'
  return 'marker-primary'
}

function getStatusColor(color: string | undefined): string {
  if (!color) return '#6b7280'
  const colorMap: Record<string, string> = {
    gray: '#6b7280',
    orange: '#f97316',
    green: '#22c55e',
    red: '#ef4444',
  }
  return colorMap[color] || '#6b7280'
}

function getStatusIcon(status: string): string {
  const map: Record<string, string> = {
    pending: 'fa-hourglass-half',
    executing: 'fa-spinner fa-spin',
    success: 'fa-check-circle',
    failed: 'fa-times-circle',
    in_progress: 'fa-spinner fa-spin',
    completed: 'fa-check-circle',
  }
  return `fas ${map[status] || 'fa-info-circle'}`
}

function getActionIcon(command: string): string {
  const cmd = (command || '').toLowerCase()
  if (cmd.includes('nmap')) return 'fa-network-wired'
  if (cmd.includes('curl') || cmd.includes('wget')) return 'fa-download'
  if (cmd.includes('gobuster') || cmd.includes('ffuf')) return 'fa-search'
  if (cmd.includes('python') || cmd.includes('bash')) return 'fa-code'
  if (cmd.includes('cat') || cmd.includes('grep')) return 'fa-file-alt'
  return 'fa-terminal'
}

function getResultIcon(result: string): string {
  if (result === 'success') return 'fa-check'
  if (result === 'failed') return 'fa-times'
  return 'fa-question'
}

/** 风险分 1–10 分制 */
function getRiskScoreClass(score: number): string {
  if (score >= 8) return 'bg-red-900/50 text-red-300 border border-red-700'
  if (score >= 5) return 'bg-orange-900/50 text-orange-300 border border-orange-700'
  if (score >= 2) return 'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
  return 'bg-green-900/50 text-green-300 border border-green-700'
}
</script>

<style scoped>
/* 对话框基础样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.dialog-container {
  background: linear-gradient(135deg, #1a1c23 0%, #0f1119 100%);
  border: 1px solid #374151;
  border-radius: 12px;
  width: 90%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #374151;
  background: rgba(15, 17, 25, 0.5);
}

.dialog-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  background: linear-gradient(135deg, #ffffff 0%, #a0aec0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.dialog-close {
  background: rgba(55, 65, 81, 0.5);
  border: 1px solid #374151;
  color: #9ca3af;
  font-size: 1.125rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: all 0.2s;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-close:hover {
  background-color: #374151;
  color: #ffffff;
  transform: rotate(90deg);
}

.dialog-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.dialog-footer {
  padding: 1rem 2rem;
  border-top: 1px solid #374151;
  display: flex;
  justify-content: flex-end;
  background: rgba(15, 17, 25, 0.5);
}

.btn-close {
  background: linear-gradient(135deg, #374151 0%, #4b5563 100%);
  color: #ffffff;
  border: none;
  padding: 0.625rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-close:hover {
  background: linear-gradient(135deg, #4b5563 0%, #6b7280 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
}

/* 卡片式布局 */
.node-detail {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.info-card {
  background: linear-gradient(135deg, rgba(15, 17, 25, 0.8) 0%, rgba(26, 28, 35, 0.8) 100%);
  border: 1px solid #374151;
  border-radius: 10px;
  padding: 1.25rem;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.info-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, currentColor, transparent);
  opacity: 0;
  transition: opacity 0.3s;
}

.info-card:hover {
  border-color: #4b5563;
  transform: translateY(-2px);
  box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.3);
}

.info-card:hover::before {
  opacity: 0.3;
}

.card-status::before {
  color: #3b82f6;
}

.card-summary::before {
  color: #06b6d4;
}

.card-context::before {
  color: #22c55e;
}

.card-actions::before {
  color: #f59e0b;
}

.card-plans::before {
  color: #a855f7;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(55, 65, 81, 0.5);
}

.card-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  flex-shrink: 0;
}

.status-icon {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%);
  color: #60a5fa;
}

.summary-icon {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(6, 182, 212, 0.1) 100%);
  color: #22d3ee;
}

.summary-text {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: #e5e7eb;
  white-space: pre-wrap;
  word-break: break-word;
}

.context-icon {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%);
  color: #4ade80;
}

.actions-icon {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%);
  color: #fbbf24;
}

.plans-icon {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(168, 85, 247, 0.1) 100%);
  color: #c084fc;
}

.card-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
  flex: 1;
}

.card-badge {
  background: rgba(55, 65, 81, 0.5);
  color: #9ca3af;
  padding: 0.25rem 0.625rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.card-content {
  color: #e5e7eb;
}

/* 节点状态样式 */
.status-badge-large {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  transition: all 0.2s;
}

.status-badge-large i {
  font-size: 1.25rem;
}

.status-info {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.status-warning {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.status-success {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.status-danger {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.status-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #9ca3af;
}

.meta-label {
  font-weight: 500;
}

.meta-value {
  color: #d1d5db;
}

/* 环境上下文样式 */
.collapse-wrapper {
  border-radius: 8px;
  overflow: hidden;
}

.collapse-button-modern {
  width: 100%;
  background: rgba(11, 13, 20, 0.6);
  border: 1px solid #374151;
  padding: 0.875rem 1rem;
  color: #d1d5db;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 8px;
  font-weight: 500;
}

.collapse-button-modern:hover {
  background: rgba(31, 41, 55, 0.8);
  border-color: #4b5563;
}

.transition-icon {
  transition: transform 0.3s ease;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.log-content-modern {
  margin-top: 0.75rem;
  background: rgba(11, 13, 20, 0.8);
  border: 1px solid #374151;
  border-radius: 8px;
  overflow: hidden;
}

.log-header {
  background: rgba(55, 65, 81, 0.5);
  padding: 0.625rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #9ca3af;
  font-weight: 500;
}

.log-text {
  margin: 0;
  padding: 1rem;
  font-family: 'Courier New', 'Consolas', monospace;
  font-size: 0.8125rem;
  color: #9ca3af;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
  max-height: 24rem;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.3);
}

/* 本任务正在执行区块 */
.executing-for-task-block {
  background: rgba(202, 138, 4, 0.08);
  border: 1px solid rgba(202, 138, 4, 0.25);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
}
.executing-mini-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.executing-mini-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  min-width: 0;
  flex: 1;
}
.executing-mini-time {
  flex-shrink: 0;
  color: #6b7280;
}

/* 历史操作时间轴样式 */
.actions-timeline-modern {
  position: relative;
  padding-left: 2.5rem;
}

.timeline-item-modern {
  position: relative;
  padding-bottom: 1.25rem;
  animation: fadeInUp 0.3s ease-out;
  animation-fill-mode: both;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.timeline-item-modern:last-child {
  padding-bottom: 0;
}

.timeline-marker-modern {
  position: absolute;
  left: -2rem;
  top: 0.5rem;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid;
  font-size: 0.75rem;
  z-index: 1;
}

.marker-success {
  background-color: rgba(34, 197, 94, 0.2);
  border-color: #22c55e;
  color: #22c55e;
}

.marker-danger {
  background-color: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #ef4444;
}

.marker-primary {
  background-color: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
  color: #3b82f6;
}

.timeline-item-modern:not(:last-child)::after {
  content: '';
  position: absolute;
  left: -1.125rem;
  top: 2.5rem;
  bottom: -1.25rem;
  width: 2px;
  background: linear-gradient(180deg, #374151 0%, transparent 100%);
}

.timeline-content-modern {
  position: relative;
}

.action-card {
  background: rgba(11, 13, 20, 0.6);
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.2s;
}

.action-card:hover {
  border-color: #4b5563;
  background: rgba(11, 13, 20, 0.8);
  transform: translateX(4px);
}

.action-header-modern {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.action-title-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.action-icon {
  color: #60a5fa;
  font-size: 0.875rem;
}

.action-command-modern {
  color: #ffffff;
  font-family: 'Courier New', 'Consolas', monospace;
  font-size: 0.875rem;
  font-weight: 600;
}

.action-card-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(55, 65, 81, 0.5);
}
.action-timestamp-modern {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: #9ca3af;
  font-size: 0.75rem;
}

.action-params-modern {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.8125rem;
}

.params-label {
  color: #9ca3af;
  font-weight: 500;
  flex-shrink: 0;
}

.params-value {
  color: #d1d5db;
  background: rgba(55, 65, 81, 0.3);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: 'Courier New', 'Consolas', monospace;
  font-size: 0.75rem;
  word-break: break-all;
}

.action-result-modern {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.result-label {
  color: #9ca3af;
  font-size: 0.8125rem;
  font-weight: 500;
}

.result-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
}

.text-success {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.text-danger {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.text-gray-400 {
  background: rgba(55, 65, 81, 0.3);
  color: #9ca3af;
  border: 1px solid #374151;
}

.result-detail-modern {
  color: #9ca3af;
  font-size: 0.75rem;
  font-style: italic;
}

.action-output-modern {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(55, 65, 81, 0.5);
}

.output-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #9ca3af;
  font-size: 0.75rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.output-content {
  color: #9ca3af;
  font-size: 0.75rem;
  font-family: 'Courier New', 'Consolas', monospace;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.5rem;
  border-radius: 4px;
  max-height: 6rem;
  overflow-y: auto;
}

.output-content.output-raw {
  max-height: 12rem;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 操作计划样式 */
.action-plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.875rem;
}

.plan-card {
  background: rgba(11, 13, 20, 0.6);
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.2s;
}

.plan-card:hover {
  border-color: #4b5563;
  background: rgba(11, 13, 20, 0.8);
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
}

.plan-card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.plan-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  color: #ffffff;
}

.plan-name-modern {
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 500;
  flex: 1;
}

.plan-summary-modern {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  color: #9ca3af;
  font-size: 0.75rem;
  line-height: 1.5;
}

.plan-summary-modern i {
  margin-top: 0.125rem;
  flex-shrink: 0;
}

/* 空状态样式 */
.empty-state-modern {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: #6b7280;
  text-align: center;
}

.empty-state-modern i {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
  opacity: 0.5;
}

.empty-state-modern p {
  margin: 0;
  font-size: 0.875rem;
  color: #9ca3af;
}

.loading-state-modern {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: #9ca3af;
  text-align: center;
}

.loading-state-modern i {
  font-size: 2rem;
  margin-bottom: 0.75rem;
  color: #60a5fa;
}

.loading-state-modern p {
  margin: 0;
  font-size: 0.875rem;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .dialog-container {
    width: 95%;
    max-height: 95vh;
  }

  .dialog-body {
    padding: 1rem;
    gap: 1rem;
  }

  .action-plans-grid {
    grid-template-columns: 1fr;
  }

  .actions-timeline-modern {
    padding-left: 2rem;
  }

  .timeline-marker-modern {
    left: -1.5rem;
    width: 1.5rem;
    height: 1.5rem;
  }
}
</style>
