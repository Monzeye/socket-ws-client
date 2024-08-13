export default class Event<T extends Record<string, any[]>> {
  handlers: {
    [K in keyof T]?: ((...args: T[K]) => any)[]
  }

  constructor() {
    this.handlers = {} as {
      [K in keyof T]?: ((...args: T[K]) => any)[]
    }
  }
  on<K extends keyof T>(type: K, handler: (...args: T[K]) => any) {
    if (!this.handlers[type]) {
      this.handlers[type] = []
    }
    this.handlers[type]!.push(handler.bind(this))
  }

  emit<K extends keyof T>(type: K, ...args: T[K]) {
    if (this.handlers[type]) {
      const handlers = this.handlers[type]
      for (const handler of handlers) {
        handler(...args)
      }
    }
  }
  off<K extends keyof T>(type: K, handler?: (...args: T[K]) => any) {
    if (this.handlers[type] instanceof Array) {
      const handlers = this.handlers[type]
      if (!handlers) return
      for (let i = 0; i < handlers.length; i++) {
        if (handler) {
          if (handlers[i] == handler) {
            handlers.splice(i, 1)
          }
        } else {
          handlers.splice(i, 1)
        }
      }
    }
  }
}
