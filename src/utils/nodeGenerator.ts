/**
 * 节点生成工具
 * 用于根据执行结果生成后续节点
 */

import type { Node, NextNode, Connection } from '@/types'
import { generateId } from './index'

/**
 * 根据 NextNode 数据生成节点
 */
export function generateNodeFromNextNode(
  nextNode: NextNode,
  parentNode: Node,
  index: number = 0,
  total: number = 1
): Node {
  // 计算新节点的位置（在父节点下方，水平排列）
  const spacing = 200 // 节点间距
  const startX = parentNode.x - ((total - 1) * spacing) / 2
  const x = startX + index * spacing
  const y = parentNode.y + 150 // 在父节点下方 150px

  return {
    id: generateId(),
    type: nextNode.type,
    title: nextNode.title,
    icon: nextNode.icon,
    color: nextNode.color as Node['color'],
    x,
    y,
    status: 'pending',
    stage: getAttackSurfaceStage(nextNode.type),
    metadata: nextNode.metadata || {},
  }
}

/**
 * 生成连线
 */
export function generateConnection(fromNodeId: string, toNodeId: string): Connection {
  return {
    id: generateId(),
    fromNodeId,
    toNodeId,
  }
}

/**
 * 判断节点所属的攻击面阶段
 * 阶段 0: 攻击机
 * 阶段 1: 信息收集、端口扫描、服务识别
 * 阶段 2: 漏洞利用、权限提升、横向移动
 */
export function getAttackSurfaceStage(nodeType: string): number {
  const stage0Types = ['attacker']
  const stage1Types = ['target', 'port', 'service', 'smb', 'ldap', 'dns', 'kerberos']
  const stage2Types = [
    'exploit',
    'privilege',
    'lateral',
    'password',
    'hash',
    'credential',
    'admin',
    'domain',
  ]

  if (stage0Types.includes(nodeType)) return 0
  if (stage2Types.some((type) => nodeType.includes(type))) return 2
  return 1 // 默认阶段 1
}

