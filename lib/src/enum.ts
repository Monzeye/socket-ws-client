// 原生状态
export enum WsReadyState {
  Connecting = 0,
  Open = 1,
  Closing = 2,
  Closed = 3
}
// 自定义状态
export enum State {
  Initial = 0,
  Connecting = 1,
  Open = 2,
  Reconnect = 3,
  Closing = 4,
  Closed = 5,
  Error = 6
}
