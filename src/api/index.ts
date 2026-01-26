/**
 * API 接口封装
 * 定义所有与后端交互的 API 接口
 */

import request from './request'
import type {
  StartFlowRequest,
  ExecuteActionRequest,
  PauseResumeRequest,
  Node,
  Scenario,
  Clue,
  SystemState,
} from '@/types'

// ========== 流程控制 ==========

/**
 * 启动流程
 */
export function startFlow(data: StartFlowRequest): Promise<SystemState> {
  return request.post('/flow/start', data)
}

/**
 * 暂停/继续流程
 */
export function pauseResumeFlow(data: PauseResumeRequest): Promise<SystemState> {
  return request.post('/flow/pause-resume', data)
}

/**
 * 获取系统状态
 */
export function getSystemState(): Promise<SystemState> {
  return request.get('/flow/state')
}

// ========== 节点管理 ==========

/**
 * 获取所有节点（前后端分离：连接由前端根据 parent_id 生成）
 */
export function getNodes(): Promise<{ nodes: Node[] }> {
  return request.get('/nodes')
}

/**
 * 获取节点详情
 */
export function getNodeById(nodeId: string): Promise<Node> {
  return request.get(`/nodes/${nodeId}`)
}

/**
 * 更新节点状态
 */
export function updateNodeStatus(nodeId: string, status: Node['status']): Promise<Node> {
  return request.put(`/nodes/${nodeId}/status`, { status })
}

// ========== 操作执行 ==========

/**
 * 执行操作计划
 */
export function executeAction(data: ExecuteActionRequest): Promise<any> {
  return request.post('/actions/execute', data)
}

/**
 * 获取操作计划
 */
export function getActionPlans(nodeType: string): Promise<Scenario> {
  return request.get(`/actions/plans?nodeType=${nodeType}`)
}

// ========== 线索管理 ==========

/**
 * 获取所有线索
 */
export function getClues(): Promise<Clue[]> {
  return request.get('/clues')
}

/**
 * 获取线索详情
 */
export function getClueById(clueId: string): Promise<Clue> {
  return request.get(`/clues/${clueId}`)
}

/**
 * 标记线索
 */
export function markClue(clueId: string, marked: boolean): Promise<Clue> {
  return request.put(`/clues/${clueId}/mark`, { marked })
}

// ========== 执行历史 ==========

/**
 * 获取执行历史
 */
export function getExecutionHistory(): Promise<any[]> {
  return request.get('/execution/history')
}

// ========== Action 管理 ==========

import type { Action } from '@/types'

/**
 * 获取所有 actions
 */
export function getActions(params?: {
  task_id?: number
  status?: string
  limit?: number
}): Promise<{ code: number; message: string; data: Action[] }> {
  const queryParams = new URLSearchParams()
  if (params?.task_id) queryParams.append('task_id', params.task_id.toString())
  if (params?.status) queryParams.append('status', params.status)
  if (params?.limit) queryParams.append('limit', params.limit.toString())
  
  const query = queryParams.toString()
  return request.get(`/actions${query ? `?${query}` : ''}`)
}

/**
 * 获取正在执行的 actions
 */
export function getExecutingActions(): Promise<{ code: number; message: string; data: Action[] }> {
  return request.get('/actions/executing')
}

/**
 * 获取单个 action 详情
 */
export function getActionById(actionId: number): Promise<{ code: number; message: string; data: Action }> {
  return request.get(`/actions/${actionId}`)
}

