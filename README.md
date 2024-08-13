## Socket-ws-client

### 安装

```bash
$  yarn add socket-ws-client
```

### Config

```typescript
interface SocketClientConfig {
  query?: Record<string, any> // 请求参数
  immediate?: boolean // 是否立即建立连接 默认 true
  transformProtocol?: boolean // 是否转换协议 http=>ws https=>wss 默认 true
  protocols?: any // 原生new WebSocket(url,protocols?)的第二个参数
  binaryType?: 'blob' | 'arraybuffer' // websocket 连接所传输二进制数据的类型
  heartbeat?: {
    // 心跳相关配置
    interval?: number // 心跳间隔 默认 3*1000 3秒
    pingFormat?: string | (() => any) // 心跳发送数据 默认 ping
    pongMatch?: string | RegExp | ((data: MessageEvent) => boolean) // 匹配服务端ping返回
    timeoutCount?: number // 心跳超时次数  默认 0 不启用超时
    //  timeoutCount和timeout同时配置才会开启心跳超时
    timeout?: number // 心跳超时时间 默认 0
    ignore?: boolean // message事件过滤掉ping返回消息	默认 true
    //  pongMatch匹配成功则不进入到message里
  }
  reconnect?: {
    // 重连相关配置
    interval?: number // 重连间隔 默认 3*1000 3秒
    retryCount?: number // 重来尝试次数 默认 Infinity 无数次
  }
}
```

### Property

| 属性           | 描述 | 类型 |
| -------------- | ---- | ------------- |
| binaryType     | websocket 连接所传输二进制数据的类型 | "arraybuffer" \| "blob" |
| bufferedAmount | **只读属性**，用于返回已经被[`send()`](https://developer.mozilla.org/zh-CN/docs/Web/API/WebSocket/bufferedAmount#send)方法放入队列中但还没有被发送到网络中的数据的字节数 | number |
| extensions     | **只读属性**，返回服务器已选择的扩展值 | any |
| protocol       | **只读属性**，用于返回服务器端选中的子协议的名字 | any |



### Methods

| 方法    | 描述                                                         | 类型                        |
| ------- | ------------------------------------------------------------ | --------------------------- |
| connect | 手动触发建立socket连接                                       | ()=>void                    |
| send    | 建立连接后发送消息数据,object类型数据会自动做JSON.stringify处理 | (data:any)=>void            |
| close   | 关闭socket连接                                               | ()=>void                    |
| dispose | 卸载socket                                                   | ()=>void                    |
| on      | 注册事件                                                     | (EventName,(...args)=>void) |
| off     | 移除事件                                                     | (EventName,(...args)=>void) |

### EventName

| 事件名称 | 描述                                                         |                            |
| -------- | ------------------------------------------------------------ | -------------------------- |
| state    | 状态更改事触发                                               | (state:State)=>void        |
| open     | 建立socket连接时触发                                         | (event:Event)=>void        |
| message  | 服务端下发消息时触发,对于string类型的服务端消息event.data会尝试做JSON.parse处理,转换不成功会返回源数据类型 | (event:EventMessage)=>void |
| close    | 关闭socket连接时触发                                         | (event:Event)=>void        |
| error    | 连接出错时触发                                               | (event:Event)=>void        |

### State


```typescript
enum State {
  Initial = 0, // 初始化
  Connecting = 1, // 连接中
  Open = 2, // 已连接
  Reconnect = 3, // 等待尝试重连
  Closing = 4, // 关闭中
  Closed = 5, // 已关闭
  Error = 6 // 连接错误
}
```

### 使用

```typescript
import { SocketClient, State } from 'socket-ws-client'

const socket = new SocketClient('http://localhost:8392', {
  query: {
    id: '726'
  },
  heartbeat: {
    timeout: 1000 * 3,
    timeoutCount: 5,
    pongMatch: event => {
      return event.data === 'pong'
    },
    interval: 1000 * 3,
    pingFormat: 'ping'
  },
  reconnect: {
    interval: 1000 * 5,
    retryCount: 10
  }
})

socket.on('open', () => {
  console.log('socket 连接已连接')
})

socket.on('state', state => {
  switch (state) {
    case State.Connecting:
      console.log('连接中')
      break
    case State.Open:
      console.log('连接成功')
      break
    case State.Reconnect:
      console.log('尝试重连中')
      break
    case State.Closing:
      console.log('关闭中')
      break
    case State.Closed:
      console.log('已关闭')
      break
    case State.Error:
      console.log('连接出错')
      break
  }
})

socket.on('message', event => {
  console.log('接收消息', event)
})

socket.on('close', () => {
  console.log('socket 连接已关闭')
})

function handleSend() {
  const sendData = {
    id: 0,
    message: 'hello'
  }
  socket.send(sendData)
}

function handleClose() {
  socket.close()
}

function handleConnect() {
  socket.connect()
}
```
