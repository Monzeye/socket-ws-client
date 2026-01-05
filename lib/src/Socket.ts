import Events from './Event'
import { State, WsReadyState } from './enum'
import {
  isArrayBuffer,
  isBlob,
  isTypedArray,
  isDataView,
  isFunction,
  setObjToUrlParams,
  transformProtocol,
  tryMsgParse
} from './helper'
import type {
  HeartbeatConfig,
  ReconnectConfig,
  SocketClientConfig
} from './types'

type WSocketInnerConfig = Omit<
  SocketClientConfig,
  'heartbeat' | 'reconnect'
> & { heartbeat?: HeartbeatConfig; reconnect?: ReconnectConfig }

const defaultWsConfig: SocketClientConfig = {
  query: {},
  immediate: true,
  transformProtocol: true,
  protocols: undefined,
  transformMessageData: true
}

const defaultHeartbeatConfig: HeartbeatConfig = {
  interval: 1000 * 3,
  pingFormat: 'ping',
  pongMatch: undefined,
  timeout: 0,
  timeoutCount: 0,
  ignore: true
}

const defaultReconnectConfig: ReconnectConfig = {
  interval: 1000 * 3,
  retryCount: Infinity
}

class WSocket<D = any> extends Events<{
  state: [state: State, ev?: Event]
  open: [ev: Event]
  close: [ev: CloseEvent]
  error: [ev: Event]
  message: [data: MessageEvent<D>]
  timeout: []
}> {
  static State = State
  url: string
  config: WSocketInnerConfig
  wsInstance: null | WebSocket
  state: State
  private _isChangeUrlConnect: boolean
  private _reconnectTimer: number | NodeJS.Timeout | undefined
  private _heartbeatInter: number | NodeJS.Timeout | undefined
  private _timeoutTimer: number | NodeJS.Timeout | undefined
  private _heartbeatTimers: (number | NodeJS.Timeout)[]
  private _openReconnect: boolean
  private _reconnectRetryCount: number
  private _heartbeatTimeoutCount: number
  constructor(url: string, config: SocketClientConfig = {}) {
    super()
    this.url = url
    this.config = this._getConfig(config)

    this.wsInstance = null

    this.state = State.Initial

    this._isChangeUrlConnect = false
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
  _getConfig(config: SocketClientConfig): WSocketInnerConfig {
    let heartbeat: HeartbeatConfig
    let reconnect: ReconnectConfig
    if (typeof config.heartbeat === 'boolean') {
      heartbeat = config.heartbeat ? { ...defaultHeartbeatConfig } : undefined!
    } else {
      heartbeat = {
        ...defaultHeartbeatConfig,
        ...config.heartbeat
      }
    }

    if (typeof config.reconnect === 'boolean') {
      reconnect = config.reconnect ? { ...defaultReconnectConfig } : undefined!
    } else {
      reconnect = {
        ...defaultReconnectConfig,
        ...config.reconnect
      }
    }

    return {
      ...defaultWsConfig,
      ...config,
      heartbeat,
      reconnect
    }
  }
  async setUrl(url: string) {
    const currentStatus = this.state
    if (url) {
      this.url = url
      this.state = State.Initial
      // 如果是更改url导致的关闭链接，如果是连接中或已连接的等状态，则在关闭的时候再次链接 根据_isChangeUrlConnect判断是否需要自动触发链接
      if (
        currentStatus === State.Connecting ||
        currentStatus === State.Open ||
        currentStatus === State.Reconnect
      ) {
        this._isChangeUrlConnect = true
      }
      this.close()
    }
  }
  async connect() {
    await Promise.resolve()
    this._isChangeUrlConnect = false
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

    // 开启断开重连
    this._openReconnect = true
    const { binaryType } = this.config
    this.wsInstance = new WebSocket(
      setObjToUrlParams(transformProtocol(this.url), this.config.query),
      this.config.protocols
    )

    this._changeState(State.Connecting)

    // 超时检测
    if (this.config.timeout) {
      this._timeoutTimer = setTimeout(() => {
        if (this.state !== State.Open) {
          this._changeState(State.Timeout)
          this.emit('timeout')
          this._clearHeartbeat()
          this.wsInstance?.close()
          this._reconnect()
        }
      }, this.config.timeout)
    }

    if (binaryType) {
      this.wsInstance.binaryType = binaryType
    }
    this.wsInstance.onopen = event => {
      this._heartbeat()
      this._reconnectRetryCount = 0
      this._changeState(State.Open, event)
      this._clearTimeout()
      this.emit('open', event)
    }
    this.wsInstance.onmessage = event => {
      this._receive(event)
    }
    this.wsInstance.onclose = event => {
      this._changeState(State.Closed, event)
      this.emit('close', event)
      this._clearHeartbeat()
      this._reconnect()
      // 如果是更改url导致的关闭链接，如果是连接中或已连接的等状态，则在关闭的时候再次链接
      this._isChangeUrlConnect && this.connect()
    }
    this.wsInstance.onerror = event => {
      this._changeState(State.Error, event)
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
        } else if (
          isBlob(data) ||
          isArrayBuffer(data) ||
          isTypedArray(data) ||
          isDataView(data)
        ) {
          this.wsInstance.send(data)
        } else if (typeof data === 'object') {
          this.wsInstance.send(JSON.stringify(data))
        }
        return
      }
    } else {
      console.warn('The connection has not been successfully established yet')
    }
  }
  private _isMatchHeartbeatMsg(event: MessageEvent<D>) {
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
  private _receive(event: MessageEvent<D>) {
    if (typeof event.data === 'string') {
      const newEvent = new MessageEvent<D>('message', {
        data: this.config.transformMessageData
          ? (tryMsgParse(event.data) as D)
          : event.data,
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
      isTypedArray(event.data) ||
      isDataView(event.data)
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
  private _changeState(state: State, ev?: Event) {
    if (this.state !== state) {
      this.state = state
      this.emit('state', this.state, ev)
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
    if (retryCount <= 0 || !this.config.reconnect) {
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
    this._clearTimeout()
    // 主动关闭 ==> 关闭断开重连
    this._openReconnect = false
    if (this.wsInstance?.readyState !== WsReadyState.Closed) {
      this.wsInstance?.close()
    } else {
      this._changeState(State.Closed)
    }
  }
  private _clearTimeout() {
    this._timeoutTimer && clearTimeout(this._timeoutTimer)
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
    if (this.config.heartbeat && interval) {
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
