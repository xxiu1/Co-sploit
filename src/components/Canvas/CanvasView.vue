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
        <!-- 连线（使用箭头表示父子关系） -->
        <v-arrow
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

    <!-- 节点详情对话框 -->
    <NodeDetailDialog
      v-model="showNodeDetail"
      :node="selectedNode"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useNodeStore, useCanvasStore } from '@/stores'
import type { Node, Connection } from '@/types'
import NodeComponent from './NodeComponent.vue'
import NodeDetailDialog from './NodeDetailDialog.vue'

const nodeStore = useNodeStore()
const canvasStore = useCanvasStore()

// Refs
const containerRef = ref<HTMLElement>()
const stageRef = ref<any>()
const connectionsLayerRef = ref<any>()
const nodesLayerRef = ref<any>()

// State
const selectedNodeId = computed(() => nodeStore.selectedNodeId)
const nodes = computed(() => nodeStore.nodes)
const connections = computed(() => nodeStore.connections)
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })
const showNodeDetail = ref(false)

// 选中的节点（用于详情对话框）
const selectedNode = computed(() => {
  if (!selectedNodeId.value) return null
  return nodeStore.getNode(selectedNodeId.value) || null
})

/** 布局签名：仅坐标/状态/连线变化时触发重绘，避免对 nodes 做 deep watch */
const nodesLayoutSignature = computed(() =>
  nodes.value
    .map((n) => `${n.id}:${Math.round(n.x * 10) / 10}:${Math.round(n.y * 10) / 10}:${n.status}`)
    .sort()
    .join('|')
)
const connectionsStructureSignature = computed(() =>
  connections.value
    .map((c) => `${c.id}:${c.fromNodeId}:${c.toNodeId}`)
    .sort()
    .join('|')
)

/** 仅执行中节点 id 集合变化时自动居中（防抖），避免状态抖动抢视图 */
const executingIdsKey = computed(() =>
  [...nodeStore.executingNodes].map((n) => n.id).sort().join(',')
)
let centerViewTimer: ReturnType<typeof setTimeout> | null = null

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

// 连线配置（从父节点指向子节点，从上到下）
function getConnectionConfig(connection: Connection) {
  const fromNode = nodeStore.getNode(connection.fromNodeId)
  const toNode = nodeStore.getNode(connection.toNodeId)

  if (!fromNode || !toNode) {
    // 节点不存在时不显示连线
    return { points: [0, 0, 0, 0], visible: false }
  }

  // 检查节点位置是否有效（不为0或已计算）
  if ((fromNode.x === 0 && fromNode.y === 0) || (toNode.x === 0 && toNode.y === 0)) {
    // 节点位置还未计算，暂时不显示连线
    return { points: [0, 0, 0, 0], visible: false }
  }

  // 连线从父节点底部指向子节点顶部
  // 节点中心到边缘的偏移（节点半径约为 24px）
  const nodeRadius = 24
  const fromY = fromNode.y + nodeRadius  // 父节点底部
  const toY = toNode.y - nodeRadius      // 子节点顶部

  return {
    points: [fromNode.x, fromY, toNode.x, toY],
    stroke: '#6b7280',
    fill: '#6b7280',
    strokeWidth: 2,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
    dash: [5, 5],
    opacity: 0.7,
    pointerLength: 10,  // 箭头长度
    pointerWidth: 8,     // 箭头宽度
    visible: true,
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
}

// Stage 事件
function onStageMouseDown(e: any) {
  const stage = e.target.getStage()
  if (e.target === stage) {
    // 点击空白区域，清除选择
    nodeStore.clearSelection()
  }
}

function onStageMouseMove(_e: any) {
  // 预留
}

function onStageMouseUp(_e: any) {
  // 预留
}

// 节点事件
function handleNodeClick(node: Node) {
  nodeStore.selectNode(node.id)
  showNodeDetail.value = true
}

function handleNodeDragEnd(node: Node, e: any) {
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
}

function zoomOut() {
  const width = containerRef.value?.clientWidth || 0
  const height = containerRef.value?.clientHeight || 0
  canvasStore.zoomOut(width / 2, height / 2)
}

function resetView() {
  canvasStore.reset()
}

// 强制重绘画布
function forceRedraw() {
  nextTick(() => {
    try {
      if (connectionsLayerRef.value) {
        const layer = connectionsLayerRef.value.getNode()
        if (layer) layer.draw()
      }
      if (nodesLayerRef.value) {
        const layer = nodesLayerRef.value.getNode()
        if (layer) layer.draw()
      }
      if (stageRef.value) {
        const stage = stageRef.value.getStage()
        if (stage) stage.draw()
      }
    } catch (error) {
      console.warn('[DEBUG] 重绘画布时出错:', error)
    }
  })
}

watch(executingIdsKey, (key) => {
  if (centerViewTimer) {
    clearTimeout(centerViewTimer)
    centerViewTimer = null
  }
  if (!key) return
  centerViewTimer = setTimeout(() => {
    centerViewTimer = null
    const execNodes = nodeStore.executingNodes
    if (execNodes.length === 0) return
    nextTick(() => {
      const w = containerRef.value?.clientWidth ?? 0
      const h = containerRef.value?.clientHeight ?? 0
      if (w === 0 || h === 0) return
      if (execNodes.length === 1) {
        canvasStore.centerOn(execNodes[0].x, execNodes[0].y, w, h)
      } else {
        const cx = execNodes.reduce((s, n) => s + n.x, 0) / execNodes.length
        const cy = execNodes.reduce((s, n) => s + n.y, 0) / execNodes.length
        canvasStore.centerOn(cx, cy, w, h)
      }
    })
  }, 300)
})

watch([nodesLayoutSignature, connectionsStructureSignature], () => {
  forceRedraw()
})

onMounted(() => {
  nextTick(() => {
    forceRedraw()
  })
})

onUnmounted(() => {
  if (centerViewTimer) {
    clearTimeout(centerViewTimer)
    centerViewTimer = null
  }
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

