/**
 * 转换协议http=>ws https=>wss
 * @param url string
 * @returns string
 */
export function transformProtocol(url: string) {
  if (url) {
    return url.replace(/^http/, 'ws')
  }
  return url
}
/**
 * 尝试JSON.parse
 * @param str string
 * @returns object | any[] | string | undefined | null
 */
export function tryMsgParse(
  str: string
): object | any[] | string | undefined | null {
  try {
    const parsed = JSON.parse(str)
    return parsed
  } catch {
    return str
  }
}
/**
 * 设置url的query参数
 * @param baseUrl string
 * @param obj object
 * @returns string
 */
export function setObjToUrlParams(baseUrl: string, obj?: Record<string, any>) {
  if (!obj) return baseUrl
  const parameters = objToQueryParams(obj)
  if (parameters) {
    return /\?$/.test(baseUrl)
      ? baseUrl + parameters
      : baseUrl.replace(/\/?$/, '?') + parameters
  }
  return baseUrl
}
/**
 * object转query
 * @param params object
 * @param isEncode 是否encode
 * @returns string
 */
export function objToQueryParams(params: Record<string, any>, isEncode = true) {
  function encode(str: string, isEncode = true) {
    return isEncode ? encodeURIComponent(str) : str
  }
  let result = ''
  for (const propName of Object.keys(params)) {
    const value = params[propName]
    const part = encode(propName, isEncode) + '='
    if (value !== null && value !== '' && typeof value !== 'undefined') {
      if (typeof value === 'object') {
        for (const key of Object.keys(value)) {
          if (
            value[key] !== null &&
            value[key] !== '' &&
            typeof value[key] !== 'undefined'
          ) {
            const params = propName + '[' + key + ']'
            const subPart = encode(params, isEncode) + '='
            result += '&' + subPart + encode(value[key], isEncode)
          }
        }
      } else {
        result += '&' + part + encode(value, isEncode)
      }
    }
  }
  return result.substring(1)
}
/**
 * 判断是否是Int8Array相关类型的数据
 * @param data xxxArray
 * @returns boolean
 */
export function isBufferData(data: any) {
  if (
    data instanceof Int8Array ||
    data instanceof Uint8Array ||
    data instanceof Uint8ClampedArray ||
    data instanceof Int16Array ||
    data instanceof Uint16Array ||
    data instanceof Int32Array ||
    data instanceof Uint32Array ||
    data instanceof Float32Array ||
    data instanceof Float64Array ||
    data instanceof BigInt64Array ||
    data instanceof BigUint64Array
  ) {
    return true
  }
  return false
}
/**
 * 是否是Blob
 * @param data any
 * @returns boolean
 */
export function isBlob(data: any) {
  if (data instanceof Blob) {
    return true
  }
  return false
}
/**
 * 是否是ArrayBuffer
 * @param data any
 * @returns boolean
 */
export function isArrayBuffer(data: any) {
  if (data instanceof ArrayBuffer) {
    return true
  }
  return false
}
/**
 * 是否是Function
 * @param data any
 * @returns boolean
 */
export function isFunction(value: any): value is (...args: any[]) => any {
  return typeof value === 'function'
}
