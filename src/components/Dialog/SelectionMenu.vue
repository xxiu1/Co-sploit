<template>
  <div
    class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
    @click.self="$emit('close')"
  >
    <div
      class="bg-dark-panel border border-dark-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
    >
      <!-- 标题栏 -->
      <div class="p-4 border-b border-dark-border flex items-center justify-between shrink-0">
        <h3 class="text-lg font-bold text-white flex items-center gap-2">
          <i class="fas fa-plus-circle text-purple-400"></i>
          选择线索或节点
        </h3>
        <button
          @click="$emit('close')"
          class="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- 标签切换 -->
      <div class="flex border-b border-dark-border shrink-0">
        <button
          type="button"
          class="flex-1 py-3 px-4 text-sm font-medium transition-colors"
          :class="activeTab === 'clue' ? 'text-purple-400 border-b-2 border-purple-500 bg-gray-800/30' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/20'"
          @click="activeTab = 'clue'"
        >
          <i class="fas fa-database mr-2"></i>线索列表
        </button>
        <button
          type="button"
          class="flex-1 py-3 px-4 text-sm font-medium transition-colors"
          :class="activeTab === 'node' ? 'text-purple-400 border-b-2 border-purple-500 bg-gray-800/30' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/20'"
          @click="activeTab = 'node'"
        >
          <i class="fas fa-project-diagram mr-2"></i>节点列表
        </button>
      </div>

      <!-- 内容区 -->
      <div class="flex-1 overflow-y-auto p-4 min-h-0">
        <!-- 线索列表 -->
        <div v-show="activeTab === 'clue'" class="space-y-3">
          <div v-if="clues.length === 0" class="text-center py-12 text-gray-500">
            <i class="fas fa-database text-4xl opacity-40 mb-3 block"></i>
            <p class="text-sm">暂无线索</p>
          </div>
          <div
            v-for="clue in clues"
            :key="clue.id"
            @click="handleSelect({ id: clue.id, type: 'clue', label: clue.title })"
            class="p-4 rounded-lg border border-gray-700/80 bg-gray-900/80 hover:bg-gray-800/80 hover:border-purple-600/50 cursor-pointer transition-all"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-white truncate">{{ clue.title }}</div>
                <div class="text-xs text-gray-400 mt-0.5">{{ clue.type }}</div>
                <div
                  v-if="clueDescription(clue)"
                  class="mt-2 text-xs text-gray-300 leading-relaxed line-clamp-3"
                >
                  {{ clueDescription(clue) }}
                </div>
              </div>
              <i class="fas fa-chevron-right text-gray-500 text-xs mt-1 shrink-0"></i>
            </div>
          </div>
        </div>

        <!-- 节点列表 -->
        <div v-show="activeTab === 'node'" class="space-y-3">
          <div v-if="nodes.length === 0" class="text-center py-12 text-gray-500">
            <i class="fas fa-project-diagram text-4xl opacity-40 mb-3 block"></i>
            <p class="text-sm">暂无节点</p>
          </div>
          <div
            v-for="node in nodes"
            :key="node.id"
            @click="handleSelect({ id: node.id, type: 'node', label: node.title })"
            class="p-4 rounded-lg border border-gray-700/80 bg-gray-900/80 hover:bg-gray-800/80 hover:border-purple-600/50 cursor-pointer transition-all"
          >
            <div class="flex items-center gap-3">
              <i
                :class="node.icon || 'fa-tasks'"
                class="text-lg shrink-0"
                :style="{ color: getNodeColor(node.color) }"
              ></i>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-white truncate">{{ node.title }}</div>
                <div class="text-xs text-gray-400">{{ node.type }}</div>
              </div>
              <span
                class="text-xs px-2 py-1 rounded shrink-0"
                :class="getStatusClass(node.status)"
              >
                {{ node.status }}
              </span>
              <i class="fas fa-chevron-right text-gray-500 text-xs shrink-0"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClueStore, useNodeStore } from '@/stores'
import type { Clue } from '@/types'

const clueStore = useClueStore()
const nodeStore = useNodeStore()

const activeTab = ref<'clue' | 'node'>('clue')

const clues = computed(() => clueStore.sortedClues)
const nodes = computed(() => nodeStore.nodes)

function clueDescription(clue: Clue): string {
  const desc = clue.metadata?.clue_description ?? (clue as any).analysis
  return typeof desc === 'string' && desc.trim() ? desc.trim() : ''
}

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
