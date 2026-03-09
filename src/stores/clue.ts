/**
 * 线索管理 Store
 * 管理线索的添加、查询、标记等操作
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Clue } from '@/types'
import { getClues, getClueById } from '@/api'
import { wsManager } from '@/utils/websocket'

export const useClueStore = defineStore('clue', () => {
  // ========== State ==========
  const clues = ref<Clue[]>([])
  const selectedClueId = ref<string | null>(null)
  const markedClueIds = ref<Set<string>>(new Set())

  // ========== Getters ==========
  const clueMap = computed(() => {
    const map = new Map<string, Clue>()
    clues.value.forEach((clue) => {
      map.set(clue.id, clue)
    })
    return map
  })

  const getClue = computed(() => (clueId: string) => {
    return clueMap.value.get(clueId)
  })

  const getCluesByType = computed(() => (type: string) => {
    return clues.value.filter((clue) => clue.type === type)
  })

  const markedClues = computed(() => {
    return clues.value.filter((clue) => markedClueIds.value.has(clue.id))
  })

  const unmarkedClues = computed(() => {
    return clues.value.filter((clue) => !markedClueIds.value.has(clue.id))
  })

  const selectedClue = computed(() => {
    if (!selectedClueId.value) return null
    return getClue.value(selectedClueId.value) || null
  })

  const sortedClues = computed(() => {
    return [...clues.value].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  })

  // ========== Actions ==========

  /**
   * 初始化 WebSocket 监听
   */
  function initWebSocket() {
    wsManager.on('clue_added', (data: Clue) => {
      addClue(data)
    })
    wsManager.on('clue_updated', (data: Clue) => {
      updateClue({ ...data, createdAt: (data as any).createdAt ?? new Date().toISOString() })
    })
  }

  /**
   * 设置所有线索
   */
  function setClues(newClues: Clue[]) {
    clues.value = newClues
  }

  /**
   * 添加线索
   */
  function addClue(clue: Clue) {
    const existingIndex = clues.value.findIndex((c) => c.id === clue.id)
    if (existingIndex >= 0) {
      clues.value[existingIndex] = clue
    } else {
      clues.value.push(clue)
    }
  }

  /**
   * 更新线索（合并 metadata，保证 clue_description 等 LLM 分析字段不丢失）
   */
  function updateClue(clue: Clue) {
    const index = clues.value.findIndex((c) => c.id === clue.id)
    if (index >= 0) {
      const existing = clues.value[index]
      const mergedMetadata =
        existing.metadata && clue.metadata
          ? { ...existing.metadata, ...clue.metadata }
          : (clue.metadata ?? existing.metadata ?? {})
      clues.value[index] = { ...existing, ...clue, metadata: mergedMetadata }
    } else {
      clues.value.push(clue)
    }
  }

  /**
   * 删除线索
   */
  function removeClue(clueId: string) {
    const index = clues.value.findIndex((c) => c.id === clueId)
    if (index >= 0) {
      clues.value.splice(index, 1)
    }
    markedClueIds.value.delete(clueId)
    if (selectedClueId.value === clueId) {
      selectedClueId.value = null
    }
  }

  /**
   * 选择线索
   */
  function selectClue(clueId: string | null) {
    selectedClueId.value = clueId
  }

  /**
   * 清除选择
   */
  function clearSelection() {
    selectedClueId.value = null
  }

  /**
   * 标记线索（仅本地状态；后端未实现 mark 持久化时不请求 API，避免 404）
   */
  async function markClueById(clueId: string, marked: boolean): Promise<void> {
    if (marked) {
      markedClueIds.value.add(clueId)
    } else {
      markedClueIds.value.delete(clueId)
    }
    const clue = clues.value.find((c) => c.id === clueId)
    if (clue) {
      updateClue({ ...clue, metadata: { ...clue.metadata, marked } })
    }
  }

  /**
   * 切换线索标记状态
   */
  async function toggleClueMark(clueId: string): Promise<void> {
    const isMarked = markedClueIds.value.has(clueId)
    await markClueById(clueId, !isMarked)
  }

  /**
   * 从服务器加载所有线索
   */
  async function loadClues(): Promise<void> {
    try {
      const clueList = await getClues()
      setClues(clueList)
    } catch (err: any) {
      console.error('加载线索失败:', err)
      throw err
    }
  }

  /**
   * 从服务器加载单个线索
   */
  async function loadClueById(clueId: string): Promise<void> {
    try {
      const clue = await getClueById(clueId)
      updateClue(clue)
    } catch (err: any) {
      console.error('加载线索详情失败:', err)
      throw err
    }
  }

  /**
   * 重置线索数据
   */
  function reset() {
    clues.value = []
    selectedClueId.value = null
    markedClueIds.value.clear()
  }

  return {
    // State
    clues,
    selectedClueId,
    markedClueIds,
    // Getters
    clueMap,
    getClue,
    getCluesByType,
    markedClues,
    unmarkedClues,
    selectedClue,
    sortedClues,
    // Actions
    initWebSocket,
    setClues,
    addClue,
    updateClue,
    removeClue,
    selectClue,
    clearSelection,
    markClueById,
    toggleClueMark,
    loadClues,
    loadClueById,
    reset,
  }
})

