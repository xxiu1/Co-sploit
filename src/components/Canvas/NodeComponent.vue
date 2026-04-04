<template>
  <v-group
    ref="groupRef"
    :config="groupConfig"
    @click="handleClick"
    @dragend="handleDragEnd"
    @contextmenu="handleContextMenu"
  >
    <!-- 节点状态光环（执行中/进行中）— 由 Konva.Animation 驱动，避免每帧触发 Vue 更新 -->
    <v-circle
      v-if="isExecutingNode"
      :config="pulseRingConfig1"
    />
    <v-circle
      v-if="isExecutingNode"
      :config="pulseRingConfig2"
    />
    <v-circle
      v-if="isExecutingNode"
      :config="pulseRingConfig3"
    />

    <!-- 节点主体 -->
    <v-circle
      :config="circleConfig"
    />

    <!-- 节点图标 -->
    <v-text
      :config="iconConfig"
    />

    <!-- 阶段标识（阶段二） -->
    <v-group v-if="node.stage === 2">
      <v-circle
        :config="{
          x: 20,
          y: -20,
          radius: 8,
          fill: '#ef4444',
          stroke: '#0b0d14',
          strokeWidth: 2,
        }"
      />
      <v-text
        :config="{
          x: 20,
          y: -20,
          text: 'II',
          fontSize: 10,
          fontStyle: 'bold',
          fill: '#ffffff',
          align: 'center',
          verticalAlign: 'middle',
          offsetX: 5,
          offsetY: 5,
        }"
      />
    </v-group>

    <!-- 节点标题 -->
    <v-text
      :config="titleConfig"
    />
  </v-group>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import Konva from 'konva'
import type { Node } from '@/types'

interface Props {
  node: Node
  selected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
})

const emit = defineEmits<{
  click: [node: Node]
  dragEnd: [node: Node, e: any]
  contextmenu: [node: Node, e: MouseEvent]
}>()

const groupRef = ref<{ getNode?: () => Konva.Group } | null>(null)
let pulseAnimation: Konva.Animation | null = null

const isExecutingNode = computed(
  () => props.node.status === 'executing' || props.node.status === 'in_progress'
)

/** 静态基底配置；半径/透明度由 Konva.Animation 直接写回 Konva 节点 */
const pulseRingConfig1 = {
  x: 0,
  y: 0,
  radius: 30,
  stroke: '#fbbf24',
  strokeWidth: 2,
  opacity: 0.6,
  listening: false,
  name: 'pulse-ring-1',
}
const pulseRingConfig2 = {
  x: 0,
  y: 0,
  radius: 35,
  stroke: '#fbbf24',
  strokeWidth: 1.5,
  opacity: 0.36,
  listening: false,
  name: 'pulse-ring-2',
}
const pulseRingConfig3 = {
  x: 0,
  y: 0,
  radius: 40,
  stroke: '#fbbf24',
  strokeWidth: 1,
  opacity: 0.18,
  listening: false,
  name: 'pulse-ring-3',
}

function stopPulseAnimation() {
  if (pulseAnimation) {
    pulseAnimation.stop()
    pulseAnimation = null
  }
}

function startPulseAnimation() {
  stopPulseAnimation()
  nextTick(() => {
    const group = groupRef.value?.getNode?.()
    if (!group) return
    const layer = group.getLayer()
    if (!layer) return
    const c1 = group.findOne<Konva.Circle>('.pulse-ring-1')
    const c2 = group.findOne<Konva.Circle>('.pulse-ring-2')
    const c3 = group.findOne<Konva.Circle>('.pulse-ring-3')
    if (!c1 || !c2 || !c3) return

    pulseAnimation = new Konva.Animation((frame) => {
      const t = (frame?.time ?? 0) * 0.003
      const op = 0.3 + Math.sin(t) * 0.3
      const r = 30 + Math.sin(t * 1.5) * 8
      c1.radius(r)
      c1.opacity(op)
      c2.radius(r + 5)
      c2.opacity(op * 0.6)
      c3.radius(r + 10)
      c3.opacity(op * 0.3)
    }, layer)
    pulseAnimation.start()
  })
}

watch(isExecutingNode, (executing) => {
  if (executing) startPulseAnimation()
  else stopPulseAnimation()
})

onMounted(() => {
  if (isExecutingNode.value) startPulseAnimation()
})

onUnmounted(() => {
  stopPulseAnimation()
})

const colorMap = {
  gray: { border: '#6b7280', text: '#9ca3af' },
  blue: { border: '#3b82f6', text: '#60a5fa' },
  yellow: { border: '#eab308', text: '#facc15' },
  green: { border: '#22c55e', text: '#4ade80' },
  red: { border: '#ef4444', text: '#f87171' },
  orange: { border: '#f97316', text: '#fb923c' },
  purple: { border: '#a855f7', text: '#c084fc' },
  cyan: { border: '#06b6d4', text: '#22d3ee' },
}

const statusColorMap = {
  pending: { border: '#6b7280', shadow: 'rgba(107, 114, 128, 0.4)' },
  executing: { border: '#fbbf24', shadow: 'rgba(251, 191, 36, 0.8)' },
  in_progress: { border: '#fbbf24', shadow: 'rgba(251, 191, 36, 0.8)' },
  success: { border: '#22c55e', shadow: 'rgba(34, 197, 94, 0.7)' },
  completed: { border: '#22c55e', shadow: 'rgba(34, 197, 94, 0.7)' },
  failed: { border: '#ef4444', shadow: 'rgba(239, 68, 68, 0.7)' },
}

const groupConfig = computed(() => ({
  x: props.node.x,
  y: props.node.y,
  draggable: true,
  listening: true,
}))

const effectiveStatusColor = computed(() => {
  const isRoot =
    props.node.type === 'target' ||
    (props.node.id != null && String(props.node.id).startsWith('node-target-'))
  if (isRoot) {
    const s = props.node.status
    if (s === 'executing' || s === 'in_progress') return statusColorMap.executing
    return statusColorMap.success
  }
  const s = props.node.status
  const mapped = statusColorMap[s as keyof typeof statusColorMap]
  return mapped ?? (s === 'failed' ? statusColorMap.failed : statusColorMap.pending)
})

const circleConfig = computed(() => {
  const statusColor = effectiveStatusColor.value
  const nodeColor = colorMap[props.node.color] || colorMap.gray
  const isExecuting = props.node.status === 'executing' || props.node.status === 'in_progress'
  const isRoot =
    props.node.type === 'target' ||
    (props.node.id != null && String(props.node.id).startsWith('node-target-'))
  const isReplan = props.node.metadata?.is_replan === true || props.node.color === 'cyan'
  const useStatusColor =
    !isReplan && (isRoot || (props.node.status !== 'pending' && props.node.status !== undefined))

  return {
    x: 0,
    y: 0,
    radius: 24,
    fill: '#0b0d14',
    stroke: useStatusColor ? statusColor.border : nodeColor.border,
    strokeWidth: isExecuting ? 3 : 2,
    shadowColor: statusColor.shadow,
    shadowBlur: isExecuting ? 20 : 10,
    shadowOpacity: isExecuting ? 0.8 : 0.4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  }
})

const iconConfig = computed(() => {
  const iconText = getIconText(props.node.icon)
  const statusColor = effectiveStatusColor.value
  const nodeColor = colorMap[props.node.color] || colorMap.gray
  const isRoot =
    props.node.type === 'target' ||
    (props.node.id != null && String(props.node.id).startsWith('node-target-'))
  const isReplan = props.node.metadata?.is_replan === true || props.node.color === 'cyan'
  const useStatusColor =
    !isReplan && (isRoot || (props.node.status !== 'pending' && props.node.status !== undefined))

  return {
    x: 0,
    y: 0,
    text: iconText,
    fontSize: 18,
    fontFamily: '"Font Awesome 6 Free"',
    fontStyle: '900',
    fill: useStatusColor ? statusColor.border : nodeColor.text,
    align: 'center',
    verticalAlign: 'middle',
    offsetX: 0,
    offsetY: 10,
  }
})

const titleConfig = computed(() => ({
  x: 0,
  y: 35,
  text: props.node.title,
  fontSize: 12,
  fontStyle: 'bold',
  fill: '#ffffff',
  align: 'center',
  verticalAlign: 'top',
  offsetX: 0,
  offsetY: 0,
  width: 100,
  wrap: 'word',
}))

function getIconText(icon: string): string {
  const iconMap: Record<string, string> = {
    'fa-server': '\uf233',
    'fa-tasks': '\uf0ae',
    'fa-laptop-code': '\uf5fc',
    'fa-network-wired': '\uf6ff',
    'fa-shield-alt': '\uf3ed',
    'fa-user-secret': '\uf21b',
    'fa-key': '\uf084',
    'fa-database': '\uf1c0',
    'fa-file-code': '\uf1c9',
    'fa-terminal': '\uf120',
    'fa-bug': '\uf188',
    'fa-search': '\uf002',
  }
  return iconMap[icon] || '\uf0ae'
}

function handleClick(e: any) {
  e.cancelBubble = true
  emit('click', props.node)
}

function handleDragEnd(e: any) {
  emit('dragEnd', props.node, e)
}

function handleContextMenu(e: MouseEvent) {
  emit('contextmenu', props.node, e)
}
</script>
