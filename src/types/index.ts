/**
 * 核心类型定义
 * 注意：所有数据都从后端获取，前端只负责展示和交互
 */

// ========== 节点相关 ==========
export interface Node {
  id: string
  type: string
  title: string
  icon: string
  color: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'yellow' | 'gray'
  x: number
  y: number
  status: NodeStatus
  stage?: number // 攻击面阶段
  metadata?: Record<string, any>
}

export type NodeStatus = 'pending' | 'executing' | 'success' | 'failed'

// ========== 场景相关（从后端获取） ==========
export interface Scenario {
  type: string
  title: string
  description: string
  icon: string
  color: string
  actionPlans: ActionPlan[]
}

// ========== 操作计划（从后端获取） ==========
export interface ActionPlan {
  id: string
  title: string
  tool: string
  cmd: string
  risk: 'Low' | 'Moderate' | 'High'
  riskScore: number
  priority?: number
  predictedOutcome?: string
  reasoning?: string
  logs?: string[]
  nextNodes?: NextNode[]
  isCustom?: boolean
}

export interface NextNode {
  type: string
  icon: string
  title: string
  color: string
  metadata?: Record<string, any>
}

// ========== 线索相关 ==========
export interface Clue {
  id: string
  type: string
  title: string
  metadata: Record<string, any>
  analysis?: string // LLM分析（从后端获取）
  createdAt: string
}

// ========== 执行相关 ==========
export interface ExecutionResult {
  success: boolean
  message: string
  analysis?: string
  suggestions?: string[]
  logs?: string[]
}

export interface ExecutionQueueItem {
  nodeType: string
  nodeId: string
  priority: number
  timestamp: string
}

// ========== 系统状态 ==========
export type SystemStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'

export interface SystemState {
  status: SystemStatus
  targetIP?: string
  currentExecutionNode?: string
  error?: string
}

// ========== 对话框消息 ==========
export interface DialogMessage {
  id: string
  type: 'system' | 'action' | 'user' | 'success' | 'error' | 'warning'
  content?: string
  timestamp: string
  actionData?: ActionMessageData
}

export interface ActionMessageData {
  plan: ActionPlan
  status: 'pending' | 'executing' | 'success' | 'failed'
  prediction?: string
  result?: ExecutionResult
  nodeDescription?: string
  nodeType?: string
}

// ========== 画布相关 ==========
export interface CanvasState {
  offsetX: number
  offsetY: number
  scale: number
}

// ========== 连线相关 ==========
export interface Connection {
  id: string
  fromNodeId: string
  toNodeId: string
}

// ========== API 请求/响应 ==========
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface StartFlowRequest {
  targetIP: string
}

export interface ExecuteActionRequest {
  nodeType: string
  actionPlanId: string
  modifiedCmd?: string
}

export interface PauseResumeRequest {
  action: 'pause' | 'resume'
}

// ========== WebSocket 消息 ==========
export interface WSMessage {
  type: 'node_update' | 'execution_result' | 'system_status' | 'clue_added' | 'error'
  data: any
  timestamp: string
}

