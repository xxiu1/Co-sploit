<template>
  <v-group
    :config="groupConfig"
    @click="handleClick"
    @dragend="handleDragEnd"
    @contextmenu="handleContextMenu"
  >
    <!-- 节点状态光环（执行中） -->
    <v-circle
      v-if="node.status === 'executing'"
      :config="{
        x: 0,
        y: 0,
        radius: 30,
        stroke: '#fbbf24',
        strokeWidth: 2,
        opacity: 0.6,
        listening: false,
      }"
    />
    <v-circle
      v-if="node.status === 'executing'"
      :config="{
        x: 0,
        y: 0,
        radius: 35,
        stroke: '#fbbf24',
        strokeWidth: 1,
        opacity: 0.3,
        listening: false,
      }"
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
import { computed } from 'vue'
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

// 状态颜色映射
const statusColorMap = {
  pending: { border: '#6b7280', shadow: 'rgba(107, 114, 128, 0.4)' },
  executing: { border: '#fbbf24', shadow: 'rgba(251, 191, 36, 0.8)' },
  success: { border: '#22c55e', shadow: 'rgba(34, 197, 94, 0.7)' },
  failed: { border: '#ef4444', shadow: 'rgba(239, 68, 68, 0.7)' },
}

// Group 配置
const groupConfig = computed(() => ({
  x: props.node.x,
  y: props.node.y,
  draggable: true,
  listening: true,
}))

// Circle 配置
const circleConfig = computed(() => {
  const statusColor = statusColorMap[props.node.status]
  const nodeColor = colorMap[props.node.color] || colorMap.gray

  return {
    x: 0,
    y: 0,
    radius: 24,
    fill: '#0b0d14',
    stroke: props.node.status !== 'pending' ? statusColor.border : nodeColor.border,
    strokeWidth: props.node.status === 'executing' ? 3 : 2,
    shadowColor: statusColor.shadow,
    shadowBlur: props.node.status === 'executing' ? 20 : 10,
    shadowOpacity: props.node.status === 'executing' ? 0.8 : 0.4,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  }
})

// Icon 配置
const iconConfig = computed(() => {
  // 使用 Font Awesome 图标，需要转换为文本
  // 这里简化处理，实际应该使用图标字体或 SVG
  const iconText = getIconText(props.node.icon)
  const statusColor = statusColorMap[props.node.status]
  const nodeColor = colorMap[props.node.color] || colorMap.gray

  return {
    x: 0,
    y: 0,
    text: iconText,
    fontSize: 20,
    fontFamily: 'FontAwesome',
    fill: props.node.status !== 'pending' ? statusColor.border : nodeColor.text,
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

// 获取图标文本（简化处理）
function getIconText(icon: string): string {
  // Font Awesome 图标类名转换为 Unicode
  // 这里需要根据实际图标映射
  const iconMap: Record<string, string> = {
    'fa-server': '\uf233',
    'fa-laptop-code': '\uf5fc',
    'fa-network-wired': '\uf6ff',
    'fa-shield-alt': '\uf3ed',
    'fa-user-secret': '\uf21b',
    'fa-key': '\uf084',
    'fa-database': '\uf1c0',
    'fa-file-code': '\uf1c9',
  }
  return iconMap[icon] || '\uf233'
}

// 事件处理
function handleClick() {
  emit('click', props.node)
}

function handleDragEnd(e: any) {
  emit('dragEnd', props.node, e)
}

function handleContextMenu(e: MouseEvent) {
  emit('contextmenu', props.node, e)
}
</script>

