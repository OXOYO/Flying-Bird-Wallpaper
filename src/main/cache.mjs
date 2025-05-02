import { LRUCache } from 'lru-cache'

const options = {
  // 缓存的最大条目数。超过此数量时，最久未使用的条目会被淘汰
  max: 1000,
  // 缓存的最大大小（基于 sizeCalculation 计算的值）
  maxSize: 1000 * 1024 * 1024, // 1GB
  // 用于计算缓存项大小的函数
  sizeCalculation: (value, key) => {
    // 计算 data 的大小
    const dataSize = value.data.length
    // 计算 headers 的大小
    const headersSize = Buffer.byteLength(JSON.stringify(value.headers))
    // 返回总大小
    return dataSize + headersSize
  },
  // 当缓存项被淘汰时调用的回调函数，用于清理资源
  dispose: (value, key) => {
    // console.log(`缓存项 ${key} 被淘汰，值为 ${value}`)
  },
  // 缓存项的默认存活时间（毫秒）。超过此时间后，缓存项会自动失效。
  ttl: 1000 * 60 * 30,
  // 是否自动清理过期的缓存项
  ttlAutopurge: true,
  // 是否允许返回过期的缓存项（即使过期，仍然可以获取到值）
  allowStale: false,
  // 当调用 get 方法时，是否更新缓存项的存活时间（TTL）
  updateAgeOnGet: false,
  // 当调用 has 方法时，是否更新缓存项的存活时间（TTL）
  updateAgeOnHas: false
  // 当缓存未命中时，用于异步获取数据的函数
  // fetchMethod: async (key, staleValue, { options, signal, context }) => {}
}

const cache = new LRUCache(options)

export default cache
