/**
 * 风险门控 Store
 * 管理待授权决策简报、轮询与授权操作
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getRiskGatePendingBrief, authorizeRiskGateAction, type RiskGatePendingBrief } from '@/api'

export const useRiskGateStore = defineStore('riskGate', () => {
  const pending = ref<RiskGatePendingBrief | null>(null)

  const hasPending = computed(() => pending.value != null)
  const actionId = computed(() => pending.value?.action_id ?? null)
  const brief = computed(() => pending.value?.brief ?? null)

  async function fetchPendingBrief() {
    try {
      const data = await getRiskGatePendingBrief()
      if (data) {
        pending.value = data
        return data
      }
      pending.value = null
      return null
    } catch {
      pending.value = null
      return null
    }
  }

  async function authorize(authorized: boolean): Promise<boolean> {
    const aid = actionId.value
    if (!aid) return false
    try {
      await authorizeRiskGateAction(aid, authorized)
      pending.value = null
      return true
    } catch {
      return false
    }
  }

  function clearPending() {
    pending.value = null
  }

  return {
    pending,
    hasPending,
    actionId,
    brief,
    fetchPendingBrief,
    authorize,
    clearPending,
  }
})
