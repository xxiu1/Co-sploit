/**
 * 节点管理 Store
 * 管理节点的创建、更新、查询等操作
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Node, NodeStatus, Connection } from '@/types'
import { getNodes, getNodeById, updateNodeStatus } from '@/api'
import { wsManager } from '@/utils/websocket'

export const useNodeStore = defineStore('node', () => {
  // ========== State ==========
  const nodes = ref<Node[]>([])
  const connections = ref<Connection[]>([])
  const selectedNodeId = ref<string | null>(null)

  // ========== Getters ==========
  const nodeMap = computed(() => {
    const map = new Map<string, Node>()
    nodes.value.forEach((node) => {
      map.set(node.id, node)
    })
    return map
  })

  const getNode = computed(() => (nodeId: string) => {
    return nodeMap.value.get(nodeId)
  })

  const getNodesByStatus = computed(() => (status: NodeStatus) => {
    return nodes.value.filter((node) => node.status === status)
  })

  const getNodesByStage = computed(() => (stage: number) => {
    return nodes.value.filter((node) => node.stage === stage)
  })

  const pendingNodes = computed(() => getNodesByStatus.value('pending'))
  const executingNodes = computed(() => getNodesByStatus.value('executing'))
  const successNodes = computed(() => getNodesByStatus.value('success'))
  const failedNodes = computed(() => getNodesByStatus.value('failed'))

  const selectedNode = computed(() => {
    if (!selectedNodeId.value) return null
    return getNode.value(selectedNodeId.value) || null
  })

  const nodeConnections = computed(() => {
    const connectionMap = new Map<string, Connection[]>()
    connections.value.forEach((conn) => {
      if (!connectionMap.has(conn.fromNodeId)) {
        connectionMap.set(conn.fromNodeId, [])
      }
      connectionMap.get(conn.fromNodeId)!.push(conn)
    })
    return connectionMap
  })

  // ========== Actions ==========

  /**
   * 初始化 WebSocket 监听
   */
  function initWebSocket() {
    wsManager.on('node_update', (data: Node | Node[]) => {
      if (Array.isArray(data)) {
        setNodes(data)
      } else {
        updateNode(data)
      }
    })
  }

  /**
   * 设置所有节点
   */
  function setNodes(newNodes: Node[]) {
    nodes.value = newNodes
  }

  /**
   * 添加节点
   */
  function addNode(node: Node) {
    const existingIndex = nodes.value.findIndex((n) => n.id === node.id)
    if (existingIndex >= 0) {
      nodes.value[existingIndex] = node
    } else {
      nodes.value.push(node)
    }
  }

  /**
   * 更新节点
   */
  function updateNode(node: Node) {
    const index = nodes.value.findIndex((n) => n.id === node.id)
    if (index >= 0) {
      nodes.value[index] = { ...nodes.value[index], ...node }
    } else {
      nodes.value.push(node)
    }
  }

  /**
   * 更新节点状态
   */
  async function updateNodeStatusById(nodeId: string, newStatus: NodeStatus): Promise<void> {
    try {
      const updatedNode = await updateNodeStatus(nodeId, newStatus)
      updateNode(updatedNode)
    } catch (err: any) {
      console.error('更新节点状态失败:', err)
      throw err
    }
  }

  /**
   * 更新节点位置
   */
  function updateNodePosition(nodeId: string, x: number, y: number) {
    const node = getNode.value(nodeId)
    if (node) {
      updateNode({ ...node, x, y })
    }
  }

  /**
   * 删除节点
   */
  function removeNode(nodeId: string) {
    const index = nodes.value.findIndex((n) => n.id === nodeId)
    if (index >= 0) {
      nodes.value.splice(index, 1)
    }
    // 同时删除相关连线
    connections.value = connections.value.filter(
      (conn) => conn.fromNodeId !== nodeId && conn.toNodeId !== nodeId
    )
  }

  /**
   * 选择节点
   */
  function selectNode(nodeId: string | null) {
    selectedNodeId.value = nodeId
  }

  /**
   * 清除选择
   */
  function clearSelection() {
    selectedNodeId.value = null
  }

  /**
   * 设置连线
   */
  function setConnections(newConnections: Connection[]) {
    connections.value = newConnections
  }

  /**
   * 添加连线
   */
  function addConnection(connection: Connection) {
    const exists = connections.value.some(
      (conn) => conn.fromNodeId === connection.fromNodeId && conn.toNodeId === connection.toNodeId
    )
    if (!exists) {
      connections.value.push(connection)
    }
  }

  /**
   * 删除连线
   */
  function removeConnection(connectionId: string) {
    const index = connections.value.findIndex((conn) => conn.id === connectionId)
    if (index >= 0) {
      connections.value.splice(index, 1)
    }
  }

  /**
   * 获取节点的子节点（通过连线）
   */
  function getChildNodes(nodeId: string): Node[] {
    const childConnections = connections.value.filter((conn) => conn.fromNodeId === nodeId)
    return childConnections
      .map((conn) => getNode.value(conn.toNodeId))
      .filter((node): node is Node => node !== undefined)
  }

  /**
   * 获取节点的父节点（通过连线）
   */
  function getParentNodes(nodeId: string): Node[] {
    const parentConnections = connections.value.filter((conn) => conn.toNodeId === nodeId)
    return parentConnections
      .map((conn) => getNode.value(conn.fromNodeId))
      .filter((node): node is Node => node !== undefined)
  }

  /**
   * 从服务器加载所有节点
   */
  async function loadNodes(): Promise<void> {
    try {
      const nodeList = await getNodes()
      setNodes(nodeList)
    } catch (err: any) {
      console.error('加载节点失败:', err)
      throw err
    }
  }

  /**
   * 从服务器加载单个节点
   */
  async function loadNodeById(nodeId: string): Promise<void> {
    try {
      const node = await getNodeById(nodeId)
      updateNode(node)
    } catch (err: any) {
      console.error('加载节点详情失败:', err)
      throw err
    }
  }

  /**
   * 重置节点数据
   */
  function reset() {
    nodes.value = []
    connections.value = []
    selectedNodeId.value = null
  }

  return {
    // State
    nodes,
    connections,
    selectedNodeId,
    // Getters
    nodeMap,
    getNode,
    getNodesByStatus,
    getNodesByStage,
    pendingNodes,
    executingNodes,
    successNodes,
    failedNodes,
    selectedNode,
    nodeConnections,
    // Actions
    initWebSocket,
    setNodes,
    addNode,
    updateNode,
    updateNodeStatusById,
    updateNodePosition,
    removeNode,
    selectNode,
    clearSelection,
    setConnections,
    addConnection,
    removeConnection,
    getChildNodes,
    getParentNodes,
    loadNodes,
    loadNodeById,
    reset,
  }
})

