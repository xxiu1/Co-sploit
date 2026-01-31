<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="risk-gate-overlay"
      @click.self="handleBackdropClick"
    >
      <div class="risk-gate-card" @click.stop>
        <div class="card-header">
          <i class="fas fa-shield-alt text-amber-400 mr-2"></i>
          <h2 class="card-title">风险门控 — 待授权操作</h2>
          <button class="card-close" @click="handleClose" aria-label="关闭">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div v-if="brief" class="card-body">
          <!-- 命令与风险得分 -->
          <div class="section section-command">
            <div class="section-label">
              <i class="fas fa-terminal"></i> 即将执行
            </div>
            <code class="command-text">{{ brief.command }}</code>
          </div>

          <div class="section section-risk">
            <div class="section-label">
              <i class="fas fa-exclamation-triangle"></i> 风险得分
            </div>
            <div class="risk-score-row">
              <span
                class="risk-score-badge"
                :class="riskScoreClass"
              >
                {{ Math.round(brief.risk_score) }}
              </span>
              <span class="risk-score-hint">超过阈值，需人工授权</span>
            </div>
          </div>

          <!-- 风险细分（若有） -->
          <div v-if="brief.risk_breakdown && typeof brief.risk_breakdown === 'object'" class="section section-breakdown">
            <div class="section-label">风险构成</div>
            <div class="breakdown-grid">
              <div class="breakdown-item">
                <span class="breakdown-name">静态风险</span>
                <span class="breakdown-value">{{ Number(brief.risk_breakdown.static_risk).toFixed(1) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="breakdown-name">环境权重</span>
                <span class="breakdown-value">{{ Number(brief.risk_breakdown.env_weight).toFixed(1) }}</span>
              </div>
              <div class="breakdown-item">
                <span class="breakdown-name">预测系数</span>
                <span class="breakdown-value">{{ Number(brief.risk_breakdown.llm_prediction).toFixed(1) }}</span>
              </div>
            </div>
          </div>

          <div v-if="brief.risk_attribution" class="section section-attribution">
            <div class="section-label">风险归因</div>
            <p class="attribution-text">{{ brief.risk_attribution }}</p>
          </div>

          <div v-if="brief.benefit_prediction" class="section section-benefit">
            <div class="section-label">收益预测</div>
            <p class="benefit-text">{{ brief.benefit_prediction }}</p>
          </div>

          <div v-if="brief.recommendation" class="section section-recommendation">
            <div class="section-label">建议</div>
            <p class="recommendation-text">{{ brief.recommendation }}</p>
          </div>
        </div>

        <div class="card-footer">
          <button
            class="btn btn-reject"
            @click="handleReject"
            :disabled="loading"
          >
            <i class="fas fa-times"></i> 拒绝执行
          </button>
          <button
            class="btn btn-approve"
            @click="handleApprove"
            :disabled="loading"
          >
            <i class="fas fa-check"></i> 授权执行
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRiskGateStore } from '@/stores'

const riskGateStore = useRiskGateStore()
const loading = ref(false)

const visible = computed(() => riskGateStore.hasPending)
const brief = computed(() => riskGateStore.brief)

const riskScoreClass = computed(() => {
  const s = brief.value?.risk_score ?? 0
  if (s >= 80) return 'risk-high'
  if (s >= 50) return 'risk-medium'
  return 'risk-low'
})

function handleBackdropClick() {
  // 不通过点击背景关闭，必须选择授权或拒绝
}

function handleClose() {
  riskGateStore.clearPending()
}

async function handleApprove() {
  loading.value = true
  try {
    await riskGateStore.authorize(true)
  } finally {
    loading.value = false
  }
}

async function handleReject() {
  loading.value = true
  try {
    await riskGateStore.authorize(false)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.risk-gate-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.risk-gate-card {
  width: min(480px, 92vw);
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, #1a1d28 0%, #0f1219 100%);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.card-header {
  display: flex;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(251, 191, 36, 0.2);
  background: rgba(251, 191, 36, 0.06);
}
.card-title {
  flex: 1;
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #fef08a;
}
.card-close {
  padding: 0.35rem;
  color: #9ca3af;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
}
.card-close:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.card-body {
  padding: 1rem 1.25rem;
  overflow-y: auto;
}

.section {
  margin-bottom: 1rem;
}
.section:last-child {
  margin-bottom: 0;
}
.section-label {
  font-size: 0.7rem;
  color: #9ca3af;
  margin-bottom: 0.35rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.command-text {
  display: block;
  padding: 0.6rem 0.75rem;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 8px;
  font-family: ui-monospace, 'Cascadia Code', monospace;
  font-size: 0.8rem;
  color: #fef08a;
  word-break: break-all;
  line-height: 1.4;
}

.risk-score-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.risk-score-badge {
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 700;
}
.risk-score-badge.risk-high {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.5);
}
.risk-score-badge.risk-medium {
  background: rgba(249, 115, 22, 0.2);
  color: #fdba74;
  border: 1px solid rgba(249, 115, 22, 0.5);
}
.risk-score-badge.risk-low {
  background: rgba(250, 204, 21, 0.2);
  color: #fde047;
  border: 1px solid rgba(250, 204, 21, 0.5);
}
.risk-score-hint {
  font-size: 0.75rem;
  color: #9ca3af;
}

.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}
.breakdown-item {
  padding: 0.4rem 0.6rem;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
}
.breakdown-name { color: #9ca3af; }
.breakdown-value { color: #d1d5db; font-weight: 600; }

.attribution-text,
.benefit-text,
.recommendation-text {
  margin: 0;
  font-size: 0.8rem;
  color: #d1d5db;
  line-height: 1.5;
}

.card-footer {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.15);
}
.btn {
  flex: 1;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: filter 0.2s, opacity 0.2s;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-reject {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.4);
}
.btn-reject:hover:not(:disabled) {
  filter: brightness(1.15);
}
.btn-approve {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.4);
}
.btn-approve:hover:not(:disabled) {
  filter: brightness(1.15);
}
</style>
