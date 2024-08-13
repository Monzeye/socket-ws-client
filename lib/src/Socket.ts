import Events from './Event'
import { State, WsReadyState } from './enum'
import {
  isArrayBuffer,
  isBlob,
  isBufferData,
  isFunction,
  setObjToUrlParams,
  transformProtocol,
  tryMsgParse
} from './helper'
import type { SocketClientConfig } from './types'

const defaultWsConfig: SocketClientConfig = {
  query: {},
  immediate: true,
  transformProtocol: true,
  protocols: undefined,
  heartbeat: {
    interval: 1000 * 3,
    pingFormat: 'ping',
    pongMatch: undefined,
    timeout: 0,
    timeoutCount: 0,
    ignore: true
  },
  reconnect: {
    interval: 1000 * 3,
    retryCount: Infinity
  }
}

class WSocket extends Events<{
  state: [state: State]
  open: [ev: Event]
  close: [ev: CloseEvent]
  error: [ev: Event]
  message: [data: MessageEvent]
}> {
  static State = State
  url: string
  config: SocketClientConfig
  wsInstance: null | WebSocket
  state: State
  private _reconnectTimer: number | NodeJS.Timeout | undefined
  private _heartbeatInter: number | NodeJS.Timeout | undefined
  private _heartbeatTimers: (number | NodeJS.Timeout)[]
  private _openReconnect: boolean
  private _reconnectRetryCount: number
  private _heartbeatTimeoutCount: number
  constructor(url: string, config: SocketClientConfig = {}) {
    super()
    this.url = url
    this.config = { ...defaultWsConfig, ...config }
    this.wsInstance = null

    this.state = State.Initial

    this._reconnectTimer
    this._heartbeatInter
    this._heartbeatTimers = []
    // 开启端开重连
    this._openReconnect = true
    // 重试计数
    this._reconnectRetryCount = 0
    // ping重试次数
    this._heartbeatTimeoutCount = 0
    //自动触发
    this.config.immediate && this.connect()
  }
  async connect() {
    await Promise.all([])
    if (!window.WebSocket) {
      console.error('Does not support WebSocket!')
      return
    }
    if (
      this.wsInstance &&
      (this.wsInstance.readyState === WsReadyState.Open ||
        this.wsInstance.readyState === WsReadyState.Connecting)
    ) {
      return this
    }

    // 开启端开重连
    this._openReconnect = true
    const { binaryType } = this.config
    this.wsInstance = new WebSocket(
      setObjToUrlParams(transformProtocol(this.url), this.config.query),
      this.config.protocols
    )

    this._changeState(State.Connecting)
    if (binaryType) {
      this.wsInstance.binaryType = binaryType
    }
    this.wsInstance.onopen = event => {
      this._heartbeat()
      this._reconnectRetryCount = 0
      this._changeState(State.Open)
      this.emit('open', event)
    }
    this.wsInstance.onmessage = event => {
      this._receive(event)
    }
    this.wsInstance.onclose = event => {
      this._changeState(State.Closed)
      this.emit('close', event)
      this._clearHeartbeat()
      this._reconnect()
    }
    this.wsInstance.onerror = event => {
      this._changeState(State.Error)
      this.emit('error', event)
    }
    return this
  }
  get binaryType(): SocketClientConfig['binaryType'] {
    return this.wsInstance?.binaryType
  }
  set binaryType(val: BinaryType) {
    if (this.wsInstance) {
      this.wsInstance.binaryType = val
    }
    this.config.binaryType = val
  }
  get bufferedAmount() {
    return this.wsInstance?.bufferedAmount
  }
  get extensions() {
    return this.wsInstance?.extensions
  }
  get protocol() {
    return this.wsInstance?.protocol
  }
  // 发送消息
  send(data: any) {
    // 连接时直接发送
    if (this.wsInstance?.readyState === WsReadyState.Open) {
      if (data) {
        if (typeof data === 'string') {
          this.wsInstance.send(data)
        } else if (isBlob(data) || isArrayBuffer(data) || isBufferData(data)) {
          this.wsInstance.send(data)
        } else if (typeof data === 'object') {
          this.wsInstance.send(JSON.stringify(data))
        }
      }
    } else {
      console.warn('The connection has not been successfully established yet')
    }
  }
  private _isMatchHeartbeatMsg(event: MessageEvent) {
    const pongMatch = this.config.heartbeat?.pongMatch
    if (pongMatch) {
      if (isFunction(pongMatch)) {
        if (pongMatch(event)) {
          return true
        }
      } else if (pongMatch instanceof RegExp) {
        if (typeof event.data === 'string' && pongMatch.test(event.data)) {
          return true
        }
      } else if (typeof pongMatch === 'string') {
        if (event.data === pongMatch) {
          return true
        }
      }
    }
    return false
  }
  // 接收消息
  private _receive(event: MessageEvent) {
    if (typeof event.data === 'string') {
      const newEvent = new MessageEvent('message', {
        data: tryMsgParse(event.data),
        origin: event.origin,
        lastEventId: event.lastEventId,
        source: event.source,
        ports: [...event.ports]
      })
      this._resetHeartbeatTimer()
      const ignore = this.config.heartbeat?.ignore ?? true

      if (ignore) {
        const isMatch = this._isMatchHeartbeatMsg(newEvent)
        if (isMatch) {
          return
        }
      }
      this.emit('message', newEvent)
    } else if (
      isBlob(event.data) ||
      isArrayBuffer(event.data) ||
      isBufferData(event.data)
    ) {
      this._resetHeartbeatTimer()
      const ignore = this.config.heartbeat?.ignore ?? true
      if (ignore) {
        const isMatch = this._isMatchHeartbeatMsg(event)
        if (isMatch) {
          return
        }
      }
      this.emit('message', event)
    }
  }
  private _changeState(state: State) {
    if (this.state !== state) {
      this.state = state
      this.emit('state', this.state)
    }
  }
  private _clearReconnect() {
    this._reconnectTimer && clearTimeout(this._reconnectTimer)
    this._reconnectRetryCount = 0
  }
  // 重新连接
  private _reconnect() {
    if (this.state === State.Reconnect || !this._openReconnect) {
      return
    }

    this._reconnectTimer && clearTimeout(this._reconnectTimer)

    const interval = this.config.reconnect?.interval ?? 3 * 1000
    const retryCount = this.config.reconnect?.retryCount ?? Infinity

    // 重试次数=0 直接关闭
    if (retryCount <= 0) {
      this.close()
      return
    }

    // 记录重连次数
    this._reconnectRetryCount++
    // 重试次数不是无数次 并且累计大于重试次数
    if (
      retryCount !== Infinity &&
      retryCount &&
      this._reconnectRetryCount > retryCount
    ) {
      this.close()
      return
    }

    this._changeState(State.Reconnect)
    this._reconnectTimer = setTimeout(() => {
      this.connect()
    }, interval)
  }
  close() {
    if (this.wsInstance?.readyState !== WsReadyState.Closed) {
      this._changeState(State.Closing)
    }
    this._clearReconnect()
    this._clearHeartbeat()
    // 主动关闭 ==> 关闭断开重连
    this._openReconnect = false
    if (this.wsInstance?.readyState !== WsReadyState.Closed) {
      this.wsInstance?.close()
    } else {
      this._changeState(State.Closed)
    }
  }
  // 重置心跳
  private _resetHeartbeatTimer() {
    this._heartbeatTimers.map(timer => {
      timer && clearTimeout(timer)
    })
    this._heartbeatTimers = []
    this._heartbeatTimeoutCount = 0
  }
  private _clearHeartbeat() {
    this._heartbeatInter && clearInterval(this._heartbeatInter)
    this._resetHeartbeatTimer()
  }
  private _heartbeat() {
    const interval = this.config.heartbeat?.interval ?? 3 * 1000
    const timeout = this.config.heartbeat?.timeout
    const pingFormat = this.config.heartbeat?.pingFormat ?? 'ping'
    const timeoutCount = this.config.heartbeat?.timeoutCount
    // const pongMatch = this.config.heartbeat?.pongMatch;
    this._clearHeartbeat()
    // 如果设置了心跳间隔，启用心跳逻辑
    if (interval) {
      this._heartbeatInter = setInterval(() => {
        // 发送ping消息，可以指定格式
        this.send(pingFormat)
        // 当timeout(超时时间)、timeoutCount(超时次数)、pongMatch(ping之后的服务器返回匹配)
        if (
          timeout &&
          timeoutCount &&
          // pongMatch &&
          // 记录池个数限制在timeoutCount次数
          // 比如： timeoutCount = 10,10次超时机会，那么超时记录池最多也就记录10个就够了
          this._heartbeatTimers.length < timeoutCount
        ) {
          const timer = setTimeout(() => {
            this._heartbeatTimeoutCount++

            if (this._heartbeatTimeoutCount >= timeoutCount) {
              this.wsInstance?.close()
              this._clearHeartbeat()
              return
            }
          }, timeout)
          // 超时次数记录池
          this._heartbeatTimers.push(timer)
        }
      }, interval)
    }
  }
  dispose() {
    this.off('close')
    this.off('error')
    this.off('open')
    this.off('state')
    this.off('message')
    this.close()
    this.wsInstance = null
  }
}

export default WSocket
