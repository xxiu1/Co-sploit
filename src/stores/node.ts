/**
 * 节点管理 Store
 * 管理节点的创建、更新、查询等操作
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Node, NodeStatus, Connection } from '@/types'

// 导入 Connection 类型（如果还没有）
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
        // 不要直接替换所有节点，而是增量更新，保留已有节点
        for (const node of data) {
          updateNode(node)
        }
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
   * 合并时保留已有 x,y，避免后端传入 0,0 覆盖前端布局导致节点“乱跑”
   */
  function updateNode(node: Node) {
    const index = nodes.value.findIndex((n) => n.id === node.id)
    if (index >= 0) {
      const existing = nodes.value[index]
      const merged = { ...existing, ...node }
      const incomingZero =
        (node.x === 0 || node.x === undefined) && (node.y === 0 || node.y === undefined)
      if (incomingZero && existing.x !== undefined && existing.y !== undefined) {
        merged.x = existing.x
        merged.y = existing.y
      }
      nodes.value[index] = merged
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
   * 根据当前 nodes 重新生成连线（用于 WS node_update 合并后刷新连线）
   */
  function regenerateConnections() {
    connections.value = generateConnectionsFromNodes(nodes.value)
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
   * 从服务器加载所有节点和连接（支持增量更新）
   */
  /**
   * 根据节点的 parent_id 生成连接（前后端分离）
   * 如果节点没有父节点，且存在初始节点（target节点），则连接到初始节点
   */
  function generateConnectionsFromNodes(nodeList: Node[]): Connection[] {
    const conns: Connection[] = []
    const nodeMap = new Map(nodeList.map(n => [n.id, n]))

    // 查找初始节点（target节点）
    const initialNode = nodeList.find(n => n.type === 'target' || n.id.startsWith('node-target-'))
    // 记录哪些节点已经有父节点连接
    const nodesWithParent = new Set<string>()

    for (const node of nodeList) {
      // 跳过初始节点本身
      if (node.type === 'target' || node.id.startsWith('node-target-')) {
        continue
      }

      const parentId = node.metadata?.parent_id
      if (parentId !== null && parentId !== undefined) {
        // 任务节点的 parent_id 是数字，需要转换为 node ID
        const parentNodeId = typeof parentId === 'number' ? `task-${parentId}` : parentId

        // 确保父节点存在
        if (nodeMap.has(parentNodeId)) {
          conns.push({
            id: `conn-${parentNodeId}-${node.id}`,
            fromNodeId: parentNodeId,
            toNodeId: node.id,
          })
          nodesWithParent.add(node.id)
        } else {
        }
      }

      // 线索节点的 parent_clue_id（如果有）
      const parentClueId = node.metadata?.parent_clue_id
      if (parentClueId !== null && parentClueId !== undefined) {
        const parentClueNodeId = typeof parentClueId === 'number' ? `clue-${parentClueId}` : parentClueId
        if (nodeMap.has(parentClueNodeId)) {
          conns.push({
            id: `conn-${parentClueNodeId}-${node.id}`,
            fromNodeId: parentClueNodeId,
            toNodeId: node.id,
          })
          nodesWithParent.add(node.id)
        }
      }

      // 如果节点没有父节点，且存在初始节点，则连接到初始节点
      if (!nodesWithParent.has(node.id) && initialNode) {
        // 只连接任务节点（不连接线索节点）
        if (node.type === 'task') {
          conns.push({
            id: `conn-${initialNode.id}-${node.id}`,
            fromNodeId: initialNode.id,
            toNodeId: node.id,
          })
          nodesWithParent.add(node.id)
        }
      }
    }

    return conns
  }

  async function loadNodes(): Promise<void> {
    try {
      const result = await getNodes()

      console.log('[DEBUG] 收到后端节点数据:', {
        isArray: Array.isArray(result),
        hasNodes: result && typeof result === 'object' && 'nodes' in result,
        nodesCount: result && typeof result === 'object' && 'nodes' in result ? (result.nodes || []).length : 0,
      })

      // 前后端分离：后端只返回 { nodes: Node[] }，连接由前端生成
      if (result && typeof result === 'object') {
        let newNodes: Node[] = []

        if (Array.isArray(result)) {
          // 兼容旧格式（直接返回节点数组）
          newNodes = result
        } else if ('data' in result && result.data && typeof result.data === 'object' && 'nodes' in result.data) {
          // 后端返回格式：{ code, message, data: { nodes } }
          const dataNodes = (result.data as any).nodes
          newNodes = Array.isArray(dataNodes) ? dataNodes : []
        } else if ('nodes' in result) {
          // 新格式：只包含 nodes
          const resultNodes = (result as any).nodes
          newNodes = Array.isArray(resultNodes) ? resultNodes : []

          // 调试信息：打印节点详情
          if (newNodes.length > 0) {
            console.log('[DEBUG] 节点详情示例:', {
              id: newNodes[0].id,
              title: newNodes[0].title,
              status: newNodes[0].status,
              metadata: {
                history_actions_count: newNodes[0].metadata?.history_actions?.length || 0,
                action_plans_count: newNodes[0].metadata?.action_plans?.length || 0,
                state_context_length: newNodes[0].metadata?.state_context?.length || 0,
              }
            })
          }
        }

        // 增量更新：只更新变化的节点
        const oldNodeMap = new Map(nodes.value.map(n => [n.id, n]))

        // 识别新增和更新的节点
        const addedNodes: Node[] = []
        const updatedNodes: Node[] = []

        for (const newNode of newNodes) {
          // 确保节点有位置属性（如果没有，设置默认值）
          if (newNode.x === undefined || newNode.x === null) {
            newNode.x = 0
          }
          if (newNode.y === undefined || newNode.y === null) {
            newNode.y = 0
          }

          const oldNode = oldNodeMap.get(newNode.id)
          if (!oldNode) {
            // 新增节点
            addedNodes.push(newNode)
            console.log('[DEBUG] 发现新节点:', newNode.id, newNode.title)
          } else {
            // 检查是否有变化（状态、位置、metadata）
            const hasChanged =
              oldNode.status !== newNode.status ||
              oldNode.x !== newNode.x ||
              oldNode.y !== newNode.y ||
              JSON.stringify(oldNode.metadata) !== JSON.stringify(newNode.metadata)

            if (hasChanged) {
              updatedNodes.push(newNode)
              console.log('[DEBUG] 节点已更新:', newNode.id, {
                status: `${oldNode.status} -> ${newNode.status}`,
                position: `(${oldNode.x}, ${oldNode.y}) -> (${newNode.x}, ${newNode.y})`
              })
            }
          }
        }

        // 不要删除任何节点！保留所有历史节点
        // 任务完成后节点应该保留在画布上，不要删除
        const deletedNodeIds: string[] = []
        // 完全禁用删除逻辑，保留所有节点（包括前端创建的节点和已完成的节点）

        // 应用更新
        if (addedNodes.length > 0 || updatedNodes.length > 0 || deletedNodeIds.length > 0) {
          console.log('[DEBUG] 应用节点更新:', {
            added: addedNodes.length,
            updated: updatedNodes.length,
            deleted: deletedNodeIds.length
          })

          // 根节点由前端产生，合并时必须保留，确保连线能连到根
          const rootsToKeep = nodes.value.filter(
            n => n.type === 'target' || (n.id != null && String(n.id).startsWith('node-target-'))
          )

          // 更新节点列表（从当前节点出发做增量）
          const updatedNodeList = [...nodes.value]

          // 添加新节点
          for (const node of addedNodes) {
            updatedNodeList.push(node)
          }

          // 更新已存在的节点
          for (const node of updatedNodes) {
            const index = updatedNodeList.findIndex(n => n.id === node.id)
            if (index >= 0) {
              updatedNodeList[index] = node
            }
          }

          // 删除不存在的节点（但已保护前端创建的节点和已完成的节点）
          for (const nodeId of deletedNodeIds) {
            const index = updatedNodeList.findIndex(n => n.id === nodeId)
            if (index >= 0) {
              updatedNodeList.splice(index, 1)
            }
          }

          // 保证根节点一定在列表中，避免连线悬空
          for (const r of rootsToKeep) {
            if (!updatedNodeList.some(x => x.id === r.id)) {
              updatedNodeList.push(r)
            }
          }

          // 若仍无 target 节点（如首次加载、后端未返回），注入默认根节点，确保 generateConnectionsFromNodes 能生成连线
          const hasTarget = updatedNodeList.some(
            (n) => n.type === 'target' || (n.id != null && String(n.id).startsWith('node-target-'))
          )
          if (!hasTarget) {
            const containerWidth = typeof window !== 'undefined' ? window.innerWidth * 0.6 : 800
            const containerHeight = typeof window !== 'undefined' ? window.innerHeight * 0.8 : 600
            updatedNodeList.push({
              id: 'node-target-default',
              type: 'target',
              title: 'TARGET',
              icon: 'fa-server',
              color: 'gray',
              x: Math.max(400, containerWidth / 2),
              y: Math.max(200, containerHeight / 2 - 100),
              status: 'pending',
              stage: 1,
              metadata: {}
            })
          }

          nodes.value = updatedNodeList
        }

        // 前后端分离：根据节点的 parent_id 生成连接
        const generatedConnections = generateConnectionsFromNodes(nodes.value)

        // 更新连接（完全替换，因为连接是基于节点数据生成的）
        connections.value = generatedConnections
        console.log('[DEBUG] 连接已更新（前端生成）:', {
          生成数量: generatedConnections.length,
          连接详情: generatedConnections.slice(0, 5).map(c => ({ id: c.id, from: c.fromNodeId, to: c.toNodeId }))
        })

        // 同步计算节点位置（树形布局），保证首帧渲染时节点已有 x,y，连线可见
        calculateTreeLayout()
        console.log('[DEBUG] 布局计算完成，节点数量:', nodes.value.length, '连接数量:', connections.value.length)
      } else {
        console.warn('[DEBUG] 后端返回的数据格式不正确:', result)
        // 不要清空节点和连接，保留已有数据
        // setNodes([])
        // setConnections([])
      }
    } catch (err: any) {
      console.error('[DEBUG] 加载节点失败:', err)
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

  /**
   * Compute tree layout (top-down) with subtree-width awareness to avoid overlapping nodes.
   */
  function calculateTreeLayout() {
    if (nodes.value.length === 0) return

    const baseX = 600
    const baseY = 150
    const spacingX = 280
    const spacingY = 200
    const nodeSlotWidth = 220

    const nodeMap = new Map(nodes.value.map(n => [n.id, n]))
    const childrenMap = new Map<string, string[]>()
    const parentMap = new Map<string, string>()

    for (const conn of connections.value) {
      if (!childrenMap.has(conn.fromNodeId)) {
        childrenMap.set(conn.fromNodeId, [])
      }
      childrenMap.get(conn.fromNodeId)!.push(conn.toNodeId)
      parentMap.set(conn.toNodeId, conn.fromNodeId)
    }

    const targetNodes = nodes.value.filter(n => n.type === 'target' || n.id.startsWith('node-target-'))
    const rootNodes = targetNodes.length > 0
      ? targetNodes
      : nodes.value.filter(n => !parentMap.has(n.id))

    const positionedNodes = new Set<string>()
    const subtreeWidthCache = new Map<string, number>()

    function getSubtreeWidth(nodeId: string): number {
      const cached = subtreeWidthCache.get(nodeId)
      if (cached !== undefined) return cached
      const children = childrenMap.get(nodeId) || []
      if (children.length === 0) {
        subtreeWidthCache.set(nodeId, nodeSlotWidth)
        return nodeSlotWidth
      }
      const total = children.reduce((sum, cid) => sum + getSubtreeWidth(cid), 0) + (children.length - 1) * spacingX
      const width = Math.max(nodeSlotWidth, total)
      subtreeWidthCache.set(nodeId, width)
      return width
    }

    function layoutNode(nodeId: string, parentX: number, parentY: number, level: number = 0): void {
      if (positionedNodes.has(nodeId)) return
      const node = nodeMap.get(nodeId)
      if (!node) return

      const children = childrenMap.get(nodeId) || []

      if (children.length === 0) {
        if (level === 0) {
          node.x = baseX
          node.y = baseY
        } else {
          node.x = parentX
          node.y = parentY + spacingY
        }
        positionedNodes.add(nodeId)
        return
      }

      const childWidths = children.map((cid) => getSubtreeWidth(cid))
      const totalWidth = childWidths.reduce((a, b) => a + b, 0) + (children.length - 1) * spacingX
      let offsetX = parentX - totalWidth / 2

      for (let i = 0; i < children.length; i++) {
        const childId = children[i]
        const w = childWidths[i]
        const childCenterX = offsetX + w / 2
        layoutNode(childId, childCenterX, parentY + spacingY, level + 1)
        offsetX += w + spacingX
      }

      const childNodes = children.map((cid) => nodeMap.get(cid)).filter(Boolean) as typeof nodes.value
      const minX = Math.min(...childNodes.map((n) => n.x))
      const maxX = Math.max(...childNodes.map((n) => n.x))
      const centerX = (minX + maxX) / 2

      if (level === 0) {
        node.x = centerX
        node.y = baseY
      } else {
        node.x = centerX
        node.y = Math.min(...childNodes.map((n) => n.y)) - spacingY
      }
      positionedNodes.add(nodeId)
    }

    if (rootNodes.length === 1) {
      const rootNode = rootNodes[0]
      if (rootNode.type === 'target' || rootNode.id.startsWith('node-target-')) {
        if (rootNode.x === 0 && rootNode.y === 0) {
          rootNode.x = baseX
          rootNode.y = baseY
        }
        positionedNodes.add(rootNode.id)
        const children = childrenMap.get(rootNode.id) || []
        if (children.length > 0) {
          const childWidths = children.map((cid) => getSubtreeWidth(cid))
          const totalWidth = childWidths.reduce((a, b) => a + b, 0) + (children.length - 1) * spacingX
          let offsetX = rootNode.x - totalWidth / 2
          for (let i = 0; i < children.length; i++) {
            const childId = children[i]
            const w = childWidths[i]
            layoutNode(childId, offsetX + w / 2, rootNode.y + spacingY, 1)
            offsetX += w + spacingX
          }
        }
      } else {
        layoutNode(rootNode.id, baseX, baseY, 0)
      }
    } else if (rootNodes.length > 1) {
      const rootWidths = rootNodes.map((n) => getSubtreeWidth(n.id))
      const totalWidth = rootWidths.reduce((a, b) => a + b, 0) + (rootNodes.length - 1) * spacingX
      let offsetX = baseX - totalWidth / 2
      for (let i = 0; i < rootNodes.length; i++) {
        const rootNode = rootNodes[i]
        const w = rootWidths[i]
        rootNode.x = offsetX + w / 2
        rootNode.y = baseY
        positionedNodes.add(rootNode.id)
        const children = childrenMap.get(rootNode.id) || []
        if (children.length > 0) {
          const childWidths = children.map((cid) => getSubtreeWidth(cid))
          const cTotal = childWidths.reduce((a, b) => a + b, 0) + (children.length - 1) * spacingX
          let cOffset = rootNode.x - cTotal / 2
          for (let j = 0; j < children.length; j++) {
            const childId = children[j]
            const cw = childWidths[j]
            layoutNode(childId, cOffset + cw / 2, rootNode.y + spacingY, 1)
            cOffset += cw + spacingX
          }
        }
        offsetX += w + spacingX
      }
    } else {
      for (let i = 0; i < nodes.value.length; i++) {
        const node = nodes.value[i]
        if (!positionedNodes.has(node.id)) {
          node.x = baseX + (i - nodes.value.length / 2) * spacingX
          node.y = baseY
          positionedNodes.add(node.id)
        }
      }
    }

    const unpositionedNodes = nodes.value.filter((n) => !positionedNodes.has(n.id))
    if (unpositionedNodes.length > 0) {
      const maxY = nodes.value
        .filter((n) => positionedNodes.has(n.id))
        .reduce((max, n) => Math.max(max, n.y), baseY)
      const totalWidth = (unpositionedNodes.length - 1) * spacingX
      const startX = baseX - totalWidth / 2
      for (let i = 0; i < unpositionedNodes.length; i++) {
        const node = unpositionedNodes[i]
        node.x = startX + i * spacingX
        node.y = maxY + spacingY
        positionedNodes.add(node.id)
      }
    }
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
    regenerateConnections,
    getChildNodes,
    getParentNodes,
    loadNodes,
    loadNodeById,
    reset,
    calculateTreeLayout,
  }
})

