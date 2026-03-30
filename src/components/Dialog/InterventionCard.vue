<template>
  <div
    class="intervention-card rounded-lg border border-cyan-800/80 bg-cyan-950/40 p-4 text-left"
    data-testid="intervention-card"
  >
    <div class="flex flex-col gap-1 mb-3">
      <div class="flex items-center gap-2">
        <i class="fas fa-hand-paper text-cyan-400"></i>
        <h3 class="text-sm font-bold text-cyan-200 uppercase tracking-wide">
          {{ interventionTitle }}
        </h3>
        <span
          v-if="data.status !== 'pending'"
          class="text-[10px] px-2 py-0.5 rounded bg-green-900/60 text-green-300"
        >
          Submitted
        </span>
      </div>
      <p v-if="interventionTypeRaw" class="text-[10px] font-mono text-gray-500 pl-7">
        {{ interventionTypeRaw }}
      </p>
    </div>

    <div
      v-if="triggerSummaryLines.length > 0"
      class="mb-3 rounded border border-amber-800/50 bg-amber-950/30 p-3 text-xs text-amber-100/95"
    >
      <div class="font-semibold text-amber-300/90 mb-1.5 uppercase tracking-wide text-[10px]">
        Trigger summary
      </div>
      <ul class="list-disc pl-4 space-y-1 leading-relaxed">
        <li v-for="(line, idx) in triggerSummaryLines" :key="idx">{{ line }}</li>
      </ul>
    </div>

    <dl class="space-y-2 text-xs text-gray-300">
      <div>
        <dt class="text-gray-500 font-semibold">Task ID</dt>
        <dd class="font-mono text-cyan-100">{{ data.target_node_id }}</dd>
      </div>
      <div>
        <dt class="text-gray-500 font-semibold">Current goal</dt>
        <dd class="whitespace-pre-wrap">{{ data.current_goal }}</dd>
      </div>
      <div>
        <dt class="text-gray-500 font-semibold">Why blocked</dt>
        <dd class="whitespace-pre-wrap">{{ data.why_blocked }}</dd>
      </div>
      <div>
        <dt class="text-gray-500 font-semibold">What you need to do</dt>
        <dd class="whitespace-pre-wrap text-yellow-100/90">{{ data.required_action }}</dd>
      </div>
      <div>
        <dt class="text-gray-500 font-semibold">Run status / 运行状态</dt>
        <dd class="whitespace-pre-wrap">{{ runStateSummary }}</dd>
      </div>
      <div>
        <dt class="text-gray-500 font-semibold">What to return (format)</dt>
        <dd class="whitespace-pre-wrap text-purple-200/90">{{ data.expected_return_format }}</dd>
      </div>
    </dl>

    <div v-if="data.status === 'pending'" class="mt-4 space-y-2">
      <div class="flex items-center justify-between gap-3">
        <label class="block text-[10px] font-semibold text-gray-500 uppercase">
          Select clues (optional)
        </label>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-gray-400">
            {{ selectedClueIds.length }} selected
          </span>
          <button
            type="button"
            class="rounded bg-gray-800 hover:bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            :disabled="submitting"
            @click="showClueSelector = true"
          >
            Choose from list
          </button>
        </div>
      </div>

      <div v-if="selectedClueIds.length > 0" class="flex flex-wrap gap-2">
        <span
          v-for="clue in selectedClues"
          :key="clue.id"
          class="text-[10px] px-2 py-1 rounded bg-cyan-900/40 text-cyan-100 border border-cyan-700/60"
          title="Clue selected for intervention context"
        >
          {{ clue.title }}
        </span>
      </div>

      <label class="block text-[10px] font-semibold text-gray-500 uppercase">Your response</label>
      <textarea
        v-model="userInput"
        rows="5"
        class="w-full rounded border border-gray-700 bg-gray-900/90 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-cyan-600 focus:outline-none"
        placeholder="Paste the result in the format described above..."
        :disabled="submitting"
      />

      <button
        type="button"
        class="w-full rounded bg-cyan-700 hover:bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        :disabled="
          submitting ||
          (!userInput.trim() && selectedClueIds.length === 0)
        "
        @click="onSubmit"
      >
        {{ submitting ? 'Submitting…' : 'Submit' }}
      </button>
      <p v-if="error" class="text-xs text-red-400">{{ error }}</p>
    </div>
    <div v-else class="mt-3 text-xs text-green-400">
      Response recorded. The automated run will continue.
    </div>
  </div>

  <div
    v-if="showClueSelector"
    class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
    @click.self="showClueSelector = false"
  >
    <div class="bg-dark-panel border border-dark-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
      <div class="p-4 border-b border-dark-border flex items-center justify-between shrink-0">
        <h3 class="text-lg font-bold text-white flex items-center gap-2">
          <i class="fas fa-database text-purple-400"></i>
          Select Clues
        </h3>
        <button
          @click="showClueSelector = false"
          class="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 min-h-0">
        <div v-if="clues.length === 0" class="text-center py-12 text-gray-500">
          <i class="fas fa-database text-4xl opacity-40 mb-3 block"></i>
          <p class="text-sm">No clues available</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="clue in clues"
            :key="clue.id"
            class="p-4 rounded-lg border border-gray-700/80 bg-gray-900/80 hover:bg-gray-800/80 hover:border-purple-600/50 transition-all"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    class="mt-1"
                    :checked="selectedClueIds.includes(clue.id)"
                    :disabled="submitting"
                    @change="toggleClue(clue.id)"
                  />
                  <div class="text-sm font-medium text-white truncate">{{ clue.title }}</div>
                </div>
                <div class="text-xs text-gray-400 mt-1">{{ clue.type }}</div>
                <div
                  v-if="clueDescription(clue)"
                  class="mt-2 text-xs text-gray-300 leading-relaxed line-clamp-3"
                >
                  {{ clueDescription(clue) }}
                </div>
              </div>
              <i class="fas fa-check text-green-400 text-xs mt-1 shrink-0" v-if="selectedClueIds.includes(clue.id)"></i>
            </div>
          </div>
        </div>
      </div>

      <div class="p-4 border-t border-dark-border flex items-center justify-end gap-2 shrink-0">
        <button
          type="button"
          class="rounded bg-gray-800 hover:bg-gray-700 px-4 py-2 text-sm font-semibold text-white"
          @click="showClueSelector = false"
          :disabled="submitting"
        >
          Done
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { InterventionMessageData } from '@/types'
import type { Clue } from '@/types'
import { submitIntervention } from '@/api'
import { useDialogStore } from '@/stores/dialog'
import { useClueStore } from '@/stores'

const props = defineProps<{
  data: InterventionMessageData
}>()

/** Backend `intervention_type` → short English label for the card title. */
const INTERVENTION_TYPE_LABELS: Record<string, string> = {
  cross_modal_assistance: 'Cross-Modal Assistance',
  branch_correction: 'Branch Correction',
  clue_stagnation: 'Clue Stagnation (local task)',
  global_path_stagnation: 'Global Path Stagnation',
}

function titleCaseSnake(s: string): string {
  return s
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

const interventionTitle = computed(() => {
  const raw = (props.data.intervention_type || '').trim().toLowerCase()
  if (!raw) return 'Human Intervention'
  return INTERVENTION_TYPE_LABELS[raw] ?? titleCaseSnake(raw)
})

/** Show machine id under the title for debugging / clarity. */
const interventionTypeRaw = computed(() => {
  const t = (props.data.intervention_type || '').trim()
  return t || null
})

/** 服务端注入的当前阶段摘要；旧会话无该字段时回退到 Agent 填写的 interface context */
const runStateSummary = computed(() => {
  const s = (props.data.execution_state_summary || '').trim()
  if (s) return s
  const fb = (props.data.target_interface_context || '').trim()
  return fb || '—'
})

/** Distinguish clue vs action-failure vs cross-modal for operators (aligned with backend explainer). */
const triggerSummaryLines = computed(() => {
  const t = (props.data.intervention_type || '').trim().toLowerCase()
  const md = (props.data.metadata || {}) as Record<string, unknown>
  const lines: string[] = []
  if (t === 'clue_stagnation') {
    lines.push('State repair — clue stagnation: no new high-value clue from this task in the recent terminal-action window.')
    if (md.K_stale_actions != null) lines.push(`Stale-action threshold K: ${String(md.K_stale_actions)}`)
    if (md.current_streak != null || md.clue_stagnation_streak != null) {
      lines.push(`Current streak: ${String(md.current_streak ?? md.clue_stagnation_streak)}`)
    }
  } else if (t === 'global_path_stagnation') {
    lines.push(
      'State repair — global path stagnation: HIGH+factual clues not advancing across the last task batches.'
    )
    if (md.N_stale_batches != null) lines.push(`Batch threshold N: ${String(md.N_stale_batches)}`)
    if (md.current_global_streak != null) lines.push(`Global streak: ${String(md.current_global_streak)}`)
  } else if (t === 'branch_correction') {
    lines.push(
      'State repair — branch correction: consecutive terminal failures in one MITRE-style action category (includes non-zero exit and timeouts).'
    )
    if (md.action_category != null) lines.push(`Action category: ${String(md.action_category)}`)
    if (md.failure_streak != null && md.max_consecutive_failures != null) {
      lines.push(`Consecutive failures: ${String(md.failure_streak)} / threshold ${String(md.max_consecutive_failures)}`)
    }
  } else if (t === 'cross_modal_assistance') {
    lines.push('Cross-modal assistance: human steps required outside the terminal (GUI, vision, multi-app, etc.).')
  }
  return lines
})

const dialogStore = useDialogStore()
const clueStore = useClueStore()
const userInput = ref('')
const submitting = ref(false)
const error = ref('')
const showClueSelector = ref(false)
const selectedClueIds = ref<string[]>([])

const clues = computed(() => clueStore.sortedClues)
const selectedClues = computed(() => {
  const map = clueStore.clueMap
  return selectedClueIds.value.map((id) => map.get(id)).filter(Boolean) as Clue[]
})

function clueDescription(clue: Clue): string {
  const desc = clue.metadata?.clue_description ?? clue.analysis
  return typeof desc === 'string' && desc.trim() ? desc.trim() : ''
}

function toggleClue(clueId: string) {
  const set = new Set(selectedClueIds.value)
  if (set.has(clueId)) set.delete(clueId)
  else set.add(clueId)
  selectedClueIds.value = Array.from(set)
}

async function onSubmit() {
  error.value = ''
  submitting.value = true
  showClueSelector.value = false
  try {
    const trimmedNotes = userInput.value.trim()

    const selectedLines: string[] = []
    for (const clue of selectedClues.value) {
      const desc = clueDescription(clue)
      selectedLines.push(
        `- ${clue.title} (${clue.id})${desc ? `: ${desc}` : ''}`
      )
    }

    const selectionBlock =
      selectedLines.length > 0 ? `Selected clues:\n${selectedLines.join('\n')}\n\n` : ''

    // Send the combined message so backend + planner can analyze immediately.
    const finalInput = `${selectionBlock}${trimmedNotes}`.trim()

    await submitIntervention({
      intervention_id: props.data.intervention_id,
      user_input: finalInput,
    })

    dialogStore.setInterventionSubmitted(props.data.intervention_id, finalInput)

    // Do NOT call /api/flow/replan here: replan terminates the HivePentest subprocess
    // (SIGTERM, exit -15) and restarts a new process. The paused worker already
    // resumes when submitIntervention writes the response file — same process continues.
    // Use the toolbar "replan" only when you intentionally want a new subprocess.
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Submit failed'
  } finally {
    submitting.value = false
  }
}
</script>
