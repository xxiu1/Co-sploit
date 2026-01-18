<template>
  <div
    ref="containerRef"
    class="canvas-container relative w-full h-full bg-dark-bg overflow-hidden"
    @wheel="handleWheel"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
  >
    <!-- Konva Stage -->
    <v-stage
      ref="stageRef"
      :config="stageConfig"
      @mousedown="onStageMouseDown"
      @mousemove="onStageMouseMove"
      @mouseup="onStageMouseUp"
    >
      <v-layer ref="connectionsLayerRef">
        <!-- 连线 -->
        <v-line
          v-for="connection in connections"
          :key="connection.id"
          :config="getConnectionConfig(connection)"
        />
        <!-- 攻击面阶段分隔线 -->
        <v-line
          v-for="(line, index) in stageLines"
          :key="`stage-line-${index}`"
          :config="line"
        />
      </v-layer>
      <v-layer ref="nodesLayerRef">
        <!-- 节点 -->
        <NodeComponent
          v-for="node in nodes"
          :key="node.id"
          :node="node"
          :selected="selectedNodeId === node.id"
          @click="handleNodeClick"
          @drag-end="handleNodeDragEnd"
          @contextmenu="handleNodeContextMenu"
        />
      </v-layer>
    </v-stage>

    <!-- 画布控制按钮 -->
    <div class="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
      <button
        @click="zoomIn"
        class="bg-dark-panel border border-dark-border text-white px-3 py-2 rounded hover:bg-gray-700 transition-colors"
        title="放大"
      >
        <i class="fas fa-plus"></i>
      </button>
      <button
        @click="zoomOut"
        class="bg-dark-panel border border-dark-border text-white px-3 py-2 rounded hover:bg-gray-700 transition-colors"
        title="缩小"
      >
        <i class="fas fa-minus"></i>
      </button>
      <button
        @click="resetView"
        class="bg-dark-panel border border-dark-border text-white px-3 py-2 rounded hover:bg-gray-700 transition-colors"
        title="重置视图"
      >
        <i class="fas fa-home"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useNodeStore, useCanvasStore } from '@/stores'
import type { Node, Connection } from '@/types'
import NodeComponent from './NodeComponent.vue'

const nodeStore = useNodeStore()
const canvasStore = useCanvasStore()

// Refs
const containerRef = ref<HTMLElement>()
const stageRef = ref<InstanceType<typeof Stage>>()
const connectionsLayerRef = ref<InstanceType<typeof Layer>>()
const nodesLayerRef = ref<InstanceType<typeof Layer>>()

// State
const selectedNodeId = computed(() => nodeStore.selectedNodeId)
const nodes = computed(() => nodeStore.nodes)
const connections = computed(() => nodeStore.connections)
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })

// Stage config
const stageConfig = computed(() => ({
  width: containerRef.value?.clientWidth || 0,
  height: containerRef.value?.clientHeight || 0,
  x: canvasStore.offsetX,
  y: canvasStore.offsetY,
  scaleX: canvasStore.scale,
  scaleY: canvasStore.scale,
  draggable: false,
}))

// 攻击面阶段分隔线
const stageLines = computed(() => {
  const lines: any[] = []
  const width = containerRef.value?.clientWidth || 0
  const height = containerRef.value?.clientHeight || 0

  // 获取所有节点的阶段
  const stages = new Set(nodes.value.map((n) => n.stage).filter((s) => s !== undefined))
  const sortedStages = Array.from(stages).sort((a, b) => a! - b!)

  sortedStages.forEach((stage, index) => {
    if (index === 0) return // 第一个阶段不需要分隔线

    // 计算该阶段节点的平均Y坐标
    const stageNodes = nodes.value.filter((n) => n.stage === stage)
    if (stageNodes.length === 0) return

    const avgY = stageNodes.reduce((sum, n) => sum + n.y, 0) / stageNodes.length

    lines.push({
      points: [0, avgY - 50, width, avgY - 50],
      stroke: '#4b5563',
      strokeWidth: 2,
      dash: [10, 5],
      opacity: 0.5,
    })
  })

  return lines
})

// 连线配置
function getConnectionConfig(connection: Connection) {
  const fromNode = nodeStore.getNode(connection.fromNodeId)
  const toNode = nodeStore.getNode(connection.toNodeId)

  if (!fromNode || !toNode) {
    return { points: [0, 0, 0, 0], visible: false }
  }

  return {
    points: [fromNode.x, fromNode.y, toNode.x, toNode.y],
    stroke: '#6b7280',
    strokeWidth: 2,
    lineCap: 'round',
    lineJoin: 'round',
    dash: [5, 5],
    opacity: 0.6,
  }
}

// 鼠标事件处理
function handleMouseDown(e: MouseEvent) {
  if (e.button === 0) {
    // 左键
    isDragging.value = true
    dragStartPos.value = { x: e.clientX, y: e.clientY }
    canvasStore.startDrag(e.clientX, e.clientY)
  }
}

function handleMouseMove(e: MouseEvent) {
  if (isDragging.value) {
    canvasStore.updateDrag(e.clientX, e.clientY)
    updateStagePosition()
  }
}

function handleMouseUp() {
  if (isDragging.value) {
    canvasStore.endDrag()
    isDragging.value = false
  }
}

function handleMouseLeave() {
  if (isDragging.value) {
    canvasStore.endDrag()
    isDragging.value = false
  }
}

// 滚轮缩放
function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return

  const x = (e.clientX - rect.left - canvasStore.offsetX) / canvasStore.scale
  const y = (e.clientY - rect.top - canvasStore.offsetY) / canvasStore.scale

  const delta = e.deltaY > 0 ? -0.1 : 0.1
  canvasStore.zoom(delta, x, y)
  updateStagePosition()
}

// Stage 事件
function onStageMouseDown(e: any) {
  const stage = e.target.getStage()
  if (e.target === stage) {
    // 点击空白区域，清除选择
    nodeStore.clearSelection()
  }
}

function onStageMouseMove(e: any) {
  // 可以在这里添加其他交互逻辑
}

function onStageMouseUp(e: any) {
  // 可以在这里添加其他交互逻辑
}

// 节点事件
function handleNodeClick(node: Node) {
  nodeStore.selectNode(node.id)
}

function handleNodeDragEnd(node: Node, e: any) {
  const stage = e.target.getStage()
  const newX = e.target.x()
  const newY = e.target.y()
  nodeStore.updateNodePosition(node.id, newX, newY)
}

function handleNodeContextMenu(node: Node, e: MouseEvent) {
  e.preventDefault()
  // 右键菜单逻辑将在后续实现
  nodeStore.selectNode(node.id)
}

// 视图控制
function zoomIn() {
  const width = containerRef.value?.clientWidth || 0
  const height = containerRef.value?.clientHeight || 0
  canvasStore.zoomIn(width / 2, height / 2)
  updateStagePosition()
}

function zoomOut() {
  const width = containerRef.value?.clientWidth || 0
  const height = containerRef.value?.clientHeight || 0
  canvasStore.zoomOut(width / 2, height / 2)
  updateStagePosition()
}

function resetView() {
  canvasStore.reset()
  updateStagePosition()
}

function updateStagePosition() {
  // 更新 stage 位置
  if (stageRef.value) {
    const stage = stageRef.value.getStage()
    stage.x(canvasStore.offsetX)
    stage.y(canvasStore.offsetY)
    stage.scaleX(canvasStore.scale)
    stage.scaleY(canvasStore.scale)
    stage.draw()
  }
}

// 监听画布状态变化
watch(
  () => [canvasStore.offsetX, canvasStore.offsetY, canvasStore.scale],
  () => {
    updateStagePosition()
  }
)

// 监听节点变化，更新连线
watch(
  () => nodes.value,
  () => {
    if (connectionsLayerRef.value) {
      connectionsLayerRef.value.getLayer()?.draw()
    }
  },
  { deep: true }
)

onMounted(() => {
  // 初始化画布
  if (containerRef.value) {
    const width = containerRef.value.clientWidth
    const height = containerRef.value.clientHeight
    // 可以在这里设置初始视图
  }
})

onUnmounted(() => {
  canvasStore.endDrag()
})
</script>

<style scoped>
.canvas-container {
  cursor: grab;
}

.canvas-container:active {
  cursor: grabbing;
}
</style>

