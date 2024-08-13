<template>
  <div class="">
    <h1>WebSocket Client</h1>
    <input type="text" v-model="inputTextVal" placeholder="Type your message" />
    <button @click="handleSend">发送消息</button>
    <button @click="handleClose">关闭</button>
    <button @click="handleConnect">建立连接</button>
    <div>{{ stateStr }}</div>
    <div style="width: 500px; max-height: 500px; overflow-y: auto">
      <ul>
        <li v-for="(item, index) in messageList" :key="index">
          {{ item }}
        </li>
      </ul>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ref } from 'vue'
import { SocketClient } from '../lib'

const stateStr = ref('')
const inputTextVal = ref('')
const messageList = ref<any[]>([])

const socket = new SocketClient('http://localhost:8392', {
  query: {
    id: '726'
  },
  heartbeat: {
    timeout: 3 * 1000,
    timeoutCount: 5,
    // ignore: false,
    pongMatch: event => {
      return event.data === 'pong'
    },
    interval: 3 * 1000,
    pingFormat: 'ping'
  },
  reconnect: {
    interval: 1000 * 1,
    retryCount: 0
  }
})

socket.on('open', () => {
  console.log('socket 连接已连接')
})

socket.on('state', state => {
  console.log(state)
  switch (state) {
    case SocketClient.State.Connecting:
      stateStr.value = '连接中'
      break
    case SocketClient.State.Open:
      stateStr.value = '连接成功'
      break
    case SocketClient.State.Reconnect:
      stateStr.value = '尝试重连中'
      break
    case SocketClient.State.Closing:
      stateStr.value = '关闭中'
      break
    case SocketClient.State.Closed:
      stateStr.value = '已关闭'
      break
    case SocketClient.State.Error:
      stateStr.value = '连接出错'
      break
  }
})

socket.on('message', event => {
  messageList.value.unshift(event.data)
  if (messageList.value.length > 100) {
    messageList.value.pop()
  }
})

socket.on('close', () => {
  console.log('socket 连接已关闭')
})

function handleSend() {
  socket.send(inputTextVal.value)
  inputTextVal.value = ''
}

function handleClose() {
  socket.close()
}

function handleConnect() {
  socket.connect()
}
</script>
<style lang="scss" scoped>
html,
body {
  padding: 0;
  margin: 0;
}
ul,
li {
  list-style: none;
  padding: 0;
  margin: 0;
}
li + li {
  border-top: 1px solid #ddd;
}
</style>
