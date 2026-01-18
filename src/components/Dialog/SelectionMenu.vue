<template>
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-dark-panel border border-dark-border rounded-lg w-96 max-h-[80vh] overflow-hidden flex flex-col">
      <div class="p-4 border-b border-dark-border flex items-center justify-between">
        <h3 class="font-bold text-white">选择线索或节点</h3>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-white"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <!-- 线索列表 -->
        <div class="mb-4">
          <h4 class="text-sm font-bold text-gray-300 mb-2">
            <i class="fas fa-database mr-2"></i>线索
          </h4>
          <div v-if="clues.length === 0" class="text-xs text-gray-500">
            暂无线索
          </div>
          <div
            v-for="clue in clues"
            :key="clue.id"
            @click="handleSelect({ id: clue.id, type: 'clue', label: clue.title })"
            class="p-2 mb-2 bg-gray-900 hover:bg-gray-800 rounded cursor-pointer transition-colors"
          >
            <div class="text-sm text-white">{{ clue.title }}</div>
            <div class="text-xs text-gray-400">{{ clue.type }}</div>
          </div>
        </div>

        <!-- 节点列表 -->
        <div>
          <h4 class="text-sm font-bold text-gray-300 mb-2">
            <i class="fas fa-project-diagram mr-2"></i>节点
          </h4>
          <div v-if="nodes.length === 0" class="text-xs text-gray-500">
            暂无节点
          </div>
          <div
            v-for="node in nodes"
            :key="node.id"
            @click="handleSelect({ id: node.id, type: 'node', label: node.title })"
            class="p-2 mb-2 bg-gray-900 hover:bg-gray-800 rounded cursor-pointer transition-colors"
          >
            <div class="flex items-center gap-2">
              <i :class="node.icon" class="text-sm" :style="{ color: getNodeColor(node.color) }"></i>
              <div class="flex-1">
                <div class="text-sm text-white">{{ node.title }}</div>
                <div class="text-xs text-gray-400">{{ node.type }}</div>
              </div>
              <span class="text-xs px-2 py-1 rounded" :class="getStatusClass(node.status)">
                {{ node.status }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useClueStore, useNodeStore } from '@/stores'

const clueStore = useClueStore()
const nodeStore = useNodeStore()

const clues = computed(() => clueStore.sortedClues)
const nodes = computed(() => nodeStore.nodes)

function handleSelect(item: { id: string; type: string; label: string }) {
  emit('select', item)
}

function getNodeColor(color: string): string {
  const colorMap: Record<string, string> = {
    gray: '#9ca3af',
    blue: '#60a5fa',
    yellow: '#facc15',
    green: '#4ade80',
    red: '#f87171',
    orange: '#fb923c',
    purple: '#c084fc',
  }
  return colorMap[color] || colorMap.gray
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'success':
      return 'bg-green-900/50 text-green-300'
    case 'failed':
      return 'bg-red-900/50 text-red-300'
    case 'executing':
      return 'bg-yellow-900/50 text-yellow-300'
    default:
      return 'bg-gray-800 text-gray-300'
  }
}

const emit = defineEmits<{
  close: []
  select: [item: { id: string; type: string; label: string }]
}>()
</script>

