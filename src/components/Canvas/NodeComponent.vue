<template>
  <v-group
    :config="groupConfig"
    @click="handleClick"
    @dragend="handleDragEnd"
    @contextmenu="handleContextMenu"
  >
    <!-- 节点状态光环（执行中/进行中）- 动态黄色光圈 -->
    <v-circle
      v-if="isExecutingNode"
      :config="pulseCircleConfig1"
    />
    <v-circle
      v-if="isExecutingNode"
      :config="pulseCircleConfig2"
    />
    <v-circle
      v-if="isExecutingNode"
      :config="pulseCircleConfig3"
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
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import type { Node } from '@/types'

// 注意：vue-konva 3.0 使用方式
// 组件会自动注册为 v-stage, v-layer, v-circle 等

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

// 动态光圈动画
const pulseOpacity = ref(0.8)
const pulseRadius = ref(30)
let animationFrame: number | null = null
let isAnimating = false

function startAnimation() {
  if (isAnimating) return
  isAnimating = true
  animatePulse()
}

function stopAnimation() {
  isAnimating = false
  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame)
    animationFrame = null
  }
}

const isExecutingNode = computed(() =>
  props.node.status === 'executing' || props.node.status === 'in_progress'
)

function animatePulse() {
  if (!isAnimating || !isExecutingNode.value) {
    stopAnimation()
    return
  }
  
  const time = Date.now() * 0.003
  pulseOpacity.value = 0.3 + Math.sin(time) * 0.3
  pulseRadius.value = 30 + Math.sin(time * 1.5) * 8
  
  animationFrame = requestAnimationFrame(animatePulse)
}

onMounted(() => {
  if (isExecutingNode.value) {
    startAnimation()
  }
})

onUnmounted(() => {
  stopAnimation()
})

// 监听节点状态变化
watch(isExecutingNode, (executing) => {
  if (executing) {
    startAnimation()
  } else {
    stopAnimation()
  }
})

// 动态光圈配置
const pulseCircleConfig1 = computed(() => ({
  x: 0,
  y: 0,
  radius: pulseRadius.value,
  stroke: '#fbbf24',
  strokeWidth: 2,
  opacity: pulseOpacity.value,
  listening: false,
}))

const pulseCircleConfig2 = computed(() => ({
  x: 0,
  y: 0,
  radius: pulseRadius.value + 5,
  stroke: '#fbbf24',
  strokeWidth: 1.5,
  opacity: pulseOpacity.value * 0.6,
  listening: false,
}))

const pulseCircleConfig3 = computed(() => ({
  x: 0,
  y: 0,
  radius: pulseRadius.value + 10,
  stroke: '#fbbf24',
  strokeWidth: 1,
  opacity: pulseOpacity.value * 0.3,
  listening: false,
}))

// 颜色映射
const colorMap = {
  gray: { border: '#6b7280', text: '#9ca3af' },
  blue: { border: '#3b82f6', text: '#60a5fa' },
  yellow: { border: '#eab308', text: '#facc15' },
  green: { border: '#22c55e', text: '#4ade80' },
  red: { border: '#ef4444', text: '#f87171' },
  orange: { border: '#f97316', text: '#fb923c' },
  purple: { border: '#a855f7', text: '#c084fc' },
}

// 状态颜色映射：根节点与成功=绿，失败=红，执行中=动态黄
const statusColorMap = {
  pending: { border: '#6b7280', shadow: 'rgba(107, 114, 128, 0.4)' },
  executing: { border: '#fbbf24', shadow: 'rgba(251, 191, 36, 0.8)' },
  in_progress: { border: '#fbbf24', shadow: 'rgba(251, 191, 36, 0.8)' },
  success: { border: '#22c55e', shadow: 'rgba(34, 197, 94, 0.7)' },
  completed: { border: '#22c55e', shadow: 'rgba(34, 197, 94, 0.7)' },
  failed: { border: '#ef4444', shadow: 'rgba(239, 68, 68, 0.7)' },
}

// Group 配置
const groupConfig = computed(() => ({
  x: props.node.x,
  y: props.node.y,
  draggable: true,
  listening: true,
}))

// 根节点或执行成功为绿，失败为红，执行中为动态黄；状态未命中时回退
const effectiveStatusColor = computed(() => {
  const isRoot = props.node.type === 'target' || (props.node.id != null && String(props.node.id).startsWith('node-target-'))
  if (isRoot) return statusColorMap.success
  const s = props.node.status
  const mapped = statusColorMap[s as keyof typeof statusColorMap]
  return mapped ?? (s === 'failed' ? statusColorMap.failed : statusColorMap.pending)
})

// Circle 配置：根节点始终用绿，成功/完成=绿，失败=红，执行中=动态黄，其余用 statusColor（含根/成功/失败映射）
const circleConfig = computed(() => {
  const statusColor = effectiveStatusColor.value
  const nodeColor = colorMap[props.node.color] || colorMap.gray
  const isExecuting = props.node.status === 'executing' || props.node.status === 'in_progress'
  const isRoot = props.node.type === 'target' || (props.node.id != null && String(props.node.id).startsWith('node-target-'))
  const useStatusColor = isRoot || (props.node.status !== 'pending' && props.node.status !== undefined)

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

// Icon 配置：根节点始终用绿，成功/失败/执行中按状态色
const iconConfig = computed(() => {
  const iconText = getIconText(props.node.icon)
  const statusColor = effectiveStatusColor.value
  const nodeColor = colorMap[props.node.color] || colorMap.gray
  const isRoot = props.node.type === 'target' || (props.node.id != null && String(props.node.id).startsWith('node-target-'))
  const useStatusColor = isRoot || (props.node.status !== 'pending' && props.node.status !== undefined)

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

// Title 配置
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

// 获取图标文本（Font Awesome 6 Free Unicode）
function getIconText(icon: string): string {
  // Font Awesome 6 Free 图标类名转换为 Unicode
  // 使用 Font Awesome 6 的 Unicode 值
  const iconMap: Record<string, string> = {
    'fa-server': '\uf233', // server
    'fa-tasks': '\uf0ae', // tasks (list-check)
    'fa-laptop-code': '\uf5fc', // laptop-code
    'fa-network-wired': '\uf6ff', // network-wired
    'fa-shield-alt': '\uf3ed', // shield-alt (shield-halved)
    'fa-user-secret': '\uf21b', // user-secret
    'fa-key': '\uf084', // key
    'fa-database': '\uf1c0', // database
    'fa-file-code': '\uf1c9', // file-code
    'fa-terminal': '\uf120', // terminal
    'fa-bug': '\uf188', // bug
    'fa-search': '\uf002', // search
  }
  return iconMap[icon] || '\uf0ae' // 默认使用 tasks 图标
}

// 事件处理
function handleClick(e: any) {
  console.log('[DEBUG] NodeComponent 节点被点击:', props.node.id, props.node.title, e)
  e.cancelBubble = true // 阻止事件冒泡
  emit('click', props.node)
}

function handleDragEnd(e: any) {
  emit('dragEnd', props.node, e)
}

function handleContextMenu(e: MouseEvent) {
  emit('contextmenu', props.node, e)
}
</script>

