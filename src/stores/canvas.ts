/**
 * 画布状态管理 Store
 * 管理画布的偏移、缩放等状态
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CanvasState } from '@/types'

export const useCanvasStore = defineStore('canvas', () => {
  // ========== State ==========
  const offsetX = ref<number>(0)
  const offsetY = ref<number>(0)
  const scale = ref<number>(1)
  const minScale = ref<number>(0.1)
  const maxScale = ref<number>(3)
  const isDragging = ref<boolean>(false)
  const dragStart = ref<{ x: number; y: number } | null>(null)

  // ========== Getters ==========
  const canvasState = computed<CanvasState>(() => ({
    offsetX: offsetX.value,
    offsetY: offsetY.value,
    scale: scale.value,
  }))

  const canZoomIn = computed(() => scale.value < maxScale.value)
  const canZoomOut = computed(() => scale.value > minScale.value)

  // ========== Actions ==========

  /**
   * 设置画布偏移
   */
  function setOffset(x: number, y: number) {
    offsetX.value = x
    offsetY.value = y
  }

  /**
   * 设置画布缩放
   */
  function setScale(newScale: number) {
    scale.value = Math.max(minScale.value, Math.min(maxScale.value, newScale))
  }

  /**
   * 缩放画布
   */
  function zoom(delta: number, centerX?: number, centerY?: number) {
    const oldScale = scale.value
    const newScale = Math.max(
      minScale.value,
      Math.min(maxScale.value, oldScale + delta)
    )

    if (centerX !== undefined && centerY !== undefined) {
      // 以指定点为中心缩放
      const scaleFactor = newScale / oldScale
      offsetX.value = centerX - (centerX - offsetX.value) * scaleFactor
      offsetY.value = centerY - (centerY - offsetY.value) * scaleFactor
    }

    scale.value = newScale
  }

  /**
   * 放大
   */
  function zoomIn(centerX?: number, centerY?: number) {
    zoom(0.1, centerX, centerY)
  }

  /**
   * 缩小
   */
  function zoomOut(centerX?: number, centerY?: number) {
    zoom(-0.1, centerX, centerY)
  }

  /**
   * 重置缩放
   */
  function resetZoom() {
    scale.value = 1
  }

  /**
   * 重置偏移
   */
  function resetOffset() {
    offsetX.value = 0
    offsetY.value = 0
  }

  /**
   * 重置画布
   */
  function reset() {
    resetOffset()
    resetZoom()
  }

  /**
   * 平移画布
   */
  function pan(deltaX: number, deltaY: number) {
    offsetX.value += deltaX
    offsetY.value += deltaY
  }

  /**
   * 开始拖拽
   */
  function startDrag(x: number, y: number) {
    isDragging.value = true
    dragStart.value = { x, y }
  }

  /**
   * 更新拖拽
   */
  function updateDrag(x: number, y: number) {
    if (isDragging.value && dragStart.value) {
      const deltaX = x - dragStart.value.x
      const deltaY = y - dragStart.value.y
      pan(deltaX, deltaY)
      dragStart.value = { x, y }
    }
  }

  /**
   * 结束拖拽
   */
  function endDrag() {
    isDragging.value = false
    dragStart.value = null
  }

  /**
   * 设置缩放范围
   */
  function setScaleRange(min: number, max: number) {
    minScale.value = min
    maxScale.value = max
    // 确保当前缩放值在范围内
    scale.value = Math.max(min, Math.min(max, scale.value))
  }

  /**
   * 居中显示指定坐标
   */
  function centerOn(x: number, y: number, canvasWidth?: number, canvasHeight?: number) {
    if (canvasWidth !== undefined && canvasHeight !== undefined) {
      offsetX.value = canvasWidth / 2 - x * scale.value
      offsetY.value = canvasHeight / 2 - y * scale.value
    } else {
      offsetX.value = -x * scale.value
      offsetY.value = -y * scale.value
    }
  }

  /**
   * 适应画布（显示所有内容）
   */
  function fitToView(
    contentBounds: { x: number; y: number; width: number; height: number },
    canvasWidth: number,
    canvasHeight: number
  ) {
    const padding = 50
    const scaleX = (canvasWidth - padding * 2) / contentBounds.width
    const scaleY = (canvasHeight - padding * 2) / contentBounds.height
    const newScale = Math.min(scaleX, scaleY, maxScale.value)
    
    scale.value = Math.max(newScale, minScale.value)
    
    // 居中显示
    const centerX = contentBounds.x + contentBounds.width / 2
    const centerY = contentBounds.y + contentBounds.height / 2
    centerOn(centerX, centerY, canvasWidth, canvasHeight)
  }

  return {
    // State
    offsetX,
    offsetY,
    scale,
    minScale,
    maxScale,
    isDragging,
    dragStart,
    // Getters
    canvasState,
    canZoomIn,
    canZoomOut,
    // Actions
    setOffset,
    setScale,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    resetOffset,
    reset,
    pan,
    startDrag,
    updateDrag,
    endDrag,
    setScaleRange,
    centerOn,
    fitToView,
  }
})

