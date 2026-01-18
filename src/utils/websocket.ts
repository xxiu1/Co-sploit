/**
 * WebSocket 工具类
 * 用于管理与后端的 WebSocket 连接
 */

import type { WSMessage } from '@/types'

export class WebSocketManager {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000
  private listeners: Map<string, Set<(data: any) => void>> = new Map()
  private isManualClose = false

  constructor(url: string) {
    this.url = url
  }

  /**
   * 连接 WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)
        let resolved = false
        let connectionTimeout: ReturnType<typeof setTimeout> | null = null

        // 设置连接超时（5秒）
        connectionTimeout = setTimeout(() => {
          if (!resolved) {
            resolved = true
            if (this.ws) {
              this.ws.close()
            }
            reject(new Error('WebSocket connection timeout'))
          }
        }, 5000)

        this.ws.onopen = () => {
          if (connectionTimeout) {
            clearTimeout(connectionTimeout)
            connectionTimeout = null
          }
          if (!resolved) {
            resolved = true
            console.log('WebSocket connected')
            this.reconnectAttempts = 0
            resolve()
          }
        }

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

        this.ws.onerror = (error) => {
          // 不输出错误到控制台（避免噪音）
          // 错误会在 onclose 中处理
        }

        this.ws.onclose = (event) => {
          if (connectionTimeout) {
            clearTimeout(connectionTimeout)
            connectionTimeout = null
          }
          
          // 如果还未 resolve，说明连接失败了
          if (!resolved && !this.isManualClose) {
            resolved = true
            reject(new Error('WebSocket connection failed'))
            return
          }

          if (import.meta.env.DEV && this.isManualClose) {
            console.log('WebSocket closed')
          }

          if (!this.isManualClose) {
            this.reconnect()
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.isManualClose = true
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * 发送消息
   */
  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      // 静默失败，不输出错误（避免控制台噪音）
      // 仅在开发模式下输出警告
      if (import.meta.env.DEV) {
        console.debug('WebSocket is not connected, message not sent:', message)
      }
    }
  }

  /**
   * 订阅消息
   */
  on(type: string, callback: (data: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(callback)
  }

  /**
   * 取消订阅
   */
  off(type: string, callback: (data: any) => void): void {
    const callbacks = this.listeners.get(type)
    if (callbacks) {
      callbacks.delete(callback)
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: WSMessage): void {
    const callbacks = this.listeners.get(message.type)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(message.data)
        } catch (error) {
          console.error('Error in WebSocket message callback:', error)
        }
      })
    }
  }

  /**
   * 重连
   */
  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    setTimeout(() => {
      this.isManualClose = false
      this.connect().catch((error) => {
        console.error('Reconnect failed:', error)
      })
    }, this.reconnectDelay)
  }

  /**
   * 获取连接状态
   */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED
  }

  /**
   * 是否已连接
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// 创建单例实例
const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'
export const wsManager = new WebSocketManager(wsUrl)

