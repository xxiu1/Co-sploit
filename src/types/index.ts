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
  color: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'yellow' | 'gray' | 'cyan'
  x: number
  y: number
  status: NodeStatus
  stage?: number // 攻击面阶段
  metadata?: Record<string, any>
}

export type NodeStatus = 'pending' | 'executing' | 'in_progress' | 'success' | 'completed' | 'failed'

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
export type SystemStatus = 'idle' | 'running' | 'pausing' | 'paused' | 'completed' | 'failed' | 'error'

export interface SystemState {
  status: SystemStatus
  targetIP?: string
  currentExecutionNode?: string
  error?: string
}

/** Cross-modal / human intervention card (English fields from backend). */
export interface InterventionMessageData {
  intervention_id: string
  intervention_type: string
  target_node_id: number
  current_goal: string
  why_blocked: string
  required_action: string
  target_interface_context: string
  expected_return_format: string
  status: 'pending' | 'submitted' | 'resolved'
  user_input?: string
}

// ========== 对话框消息 ==========
export interface DialogMessage {
  id: string
  type: 'system' | 'action' | 'user' | 'success' | 'error' | 'warning' | 'action_execution' | 'intervention'
  content?: string
  timestamp: string
  actionData?: ActionMessageData
  /** 实时执行类 action 卡片（来自 action_started/action_ended），执行完保留为历史 */
  actionExecutionData?: ActionExecutionMessageData
  interventionData?: InterventionMessageData
}

export interface ActionMessageData {
  plan: ActionPlan
  status: 'pending' | 'executing' | 'success' | 'failed'
  prediction?: string
  result?: ExecutionResult
  nodeDescription?: string
  nodeType?: string
}

/**
 * 实时执行的 action 卡片数据：风险得分 + 预计时间 + 风险分析，执行完不消失。
 * analyze_context 格式：`[RAW]\n<原始日志>\n[LLM]\n<LLM 结果分析>`，前端按此解析展示。
 */
export interface ActionExecutionMessageData {
  action_id: number
  task_id: number
  command: string
  nodeName?: string
  risk_score?: number
  risk_brief?: string
  estimated_time?: string
  status: 'executing' | 'success' | 'failed'
  result?: ExecutionResult
  failureAnalysis?: string
  suggestions?: string[]
  started_at?: string
  finished_at?: string
  /** 执行输出与 LLM 分析，格式 [RAW]\\n...\\n[LLM]\\n... */
  analyze_context?: string
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

// ========== Action 相关 ==========
export interface Action {
  action_id: number
  command: string
  parent_node: number
  result: 'success' | 'failed' | 'unknown'
  analyze_context?: string
  risk_score?: number
  timestamp: string
  /** 从日志解析出的执行时间，优先于 timestamp 展示 */
  executed_at?: string
}

// ========== WebSocket 消息 ==========
export interface WSMessage {
  type:
    | 'node_update'
    | 'execution_result'
    | 'system_status'
    | 'clue_added'
    | 'clue_updated'
    | 'error'
    | 'terminal_output'
    | 'system_command_output'
    | 'terminal_connected'
    | 'terminal_disconnected'
    | 'action_created'
    | 'action_updated'
    | 'action_completed'
    | 'action_task_bound'
    | 'intervention_request'
    | 'intervention_resolved'
  data: any
  timestamp?: string
}

