<template>
  <div
    class="intervention-card rounded-lg border border-cyan-800/80 bg-cyan-950/40 p-4 text-left"
    data-testid="intervention-card"
  >
    <div class="flex items-center gap-2 mb-3">
      <i class="fas fa-hand-paper text-cyan-400"></i>
      <h3 class="text-sm font-bold text-cyan-200 uppercase tracking-wide">
        Cross-Modal Assistance
      </h3>
      <span
        v-if="data.status !== 'pending'"
        class="text-[10px] px-2 py-0.5 rounded bg-green-900/60 text-green-300"
      >
        Submitted
      </span>
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
        <dt class="text-gray-500 font-semibold">Where / context</dt>
        <dd class="whitespace-pre-wrap">{{ data.target_interface_context }}</dd>
      </div>
      <div>
        <dt class="text-gray-500 font-semibold">What to return (format)</dt>
        <dd class="whitespace-pre-wrap text-purple-200/90">{{ data.expected_return_format }}</dd>
      </div>
    </dl>

    <div v-if="data.status === 'pending'" class="mt-4 space-y-2">
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
        :disabled="submitting || !userInput.trim()"
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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { InterventionMessageData } from '@/types'
import { submitIntervention } from '@/api'
import { useDialogStore } from '@/stores/dialog'

const props = defineProps<{
  data: InterventionMessageData
}>()

const dialogStore = useDialogStore()
const userInput = ref('')
const submitting = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  submitting.value = true
  try {
    const trimmed = userInput.value.trim()
    await submitIntervention({
      intervention_id: props.data.intervention_id,
      user_input: trimmed,
    })
    dialogStore.setInterventionSubmitted(props.data.intervention_id, trimmed)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Submit failed'
  } finally {
    submitting.value = false
  }
}
</script>
