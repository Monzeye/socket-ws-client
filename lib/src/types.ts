export interface SocketClientConfig {
  query?: Record<string, any>
  immediate?: boolean
  transformProtocol?: boolean
  protocols?: any
  binaryType?: BinaryType
  heartbeat?: {
    interval?: number
    pingFormat?: string | (() => any)
    pongMatch?: string | RegExp | ((data: MessageEvent) => boolean)
    timeoutCount?: number
    timeout?: number
    ignore?: boolean
  }
  reconnect?: {
    interval?: number
    retryCount?: number
  }
}
