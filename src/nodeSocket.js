import WebSocket, { WebSocketServer } from 'ws'

// 服务器监听端口
const PORT = 8392

// 使用HTTP服务器创建一个WebSocket服务器
const wss = new WebSocketServer({ port: PORT })

// 监听客户端连接
wss.on('connection', ws => {
  console.log('客户端已连接')

  const pingInter = setInterval(() => {
    ws.ping('ping')
  }, 1000 * 3)

  // 每隔 5 秒向客户端发送一条消息
  const sendInter = setInterval(() => {
    const message = JSON.stringify({
      type: 'serverMessage',
      data: `当前时间: ${new Date().toLocaleTimeString()}`
    })
    ws.send(message)
  }, 5000)

  // 监听 Pong 帧
  ws.on('pong', function pong(data) {
    console.log('Pong:', data.toString())
  })

  // 监听客户端发送的消息
  ws.on('message', message => {
    const msg = message.toString()
    console.log('收到客户端消息:', msg)
    // 向所有连接的客户端广播消息
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        if (msg === 'ping') {
          client.send('pong')
          return
        }
        client.send(
          JSON.stringify({
            type: 'echoMessage',
            data: msg
          })
        )
      }
    })
  })

  // 监听客户端断开连接
  ws.on('close', () => {
    console.log('客户端已断开')
    sendInter && clearInterval(sendInter) // 停止发送消息
    // pingInter && clearInterval(pingInter);
  })
})

console.log(`WebSocket server is running on ws://localhost:${PORT}`)
