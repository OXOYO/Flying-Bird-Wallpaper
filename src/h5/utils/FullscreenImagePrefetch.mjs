/** 慢滑：当前之后预取张数 */
export const FULLSCREEN_PREFETCH_AHEAD_SLOW = 5
/** 中速连滑 */
export const FULLSCREEN_PREFETCH_AHEAD_MID = 8
/** 快速连滑上限 */
export const FULLSCREEN_PREFETCH_AHEAD_FAST = 12
/** 回看预取张数 */
export const FULLSCREEN_PREFETCH_BEHIND = 1
/** 上屏挂载窗口：当前 ±1 */
export const FULLSCREEN_MOUNT_RANGE = 1

/** 翻页间隔（ms）→ ahead 档位 */
export const PREFETCH_INTERVAL_FAST_MS = 300
export const PREFETCH_INTERVAL_MID_MS = 800

/**
 * 用 Image() 预热浏览器 HTTP 缓存（等价鸿蒙磁盘预取）：
 * - 窗口平移：连滑不轻易 generation 取消
 * - 优先级：cur+1 > cur-1 > cur+2…cur+ahead
 * - 当前未 settle 时仅预取下一页，避免抢带宽
 */
export class FullscreenImagePrefetch {
  constructor() {
    this.urls = []
    this.currentIndex = 0
    this.ahead = FULLSCREEN_PREFETCH_AHEAD_SLOW
    this.generation = 0
    /** true：可预取整窗；false：仅 cur+1 */
    this.fullPrefetchAllowed = false
    this.queue = []
    this.inFlight = new Set()
    this.done = new Set()
    this.workerCount = 0
    this.maxWorkers = 2
  }

  cancel() {
    this.generation++
    this.urls = []
    this.currentIndex = 0
    this.ahead = FULLSCREEN_PREFETCH_AHEAD_SLOW
    this.fullPrefetchAllowed = false
    this.queue = []
    this.inFlight.clear()
    this.done.clear()
    this.workerCount = 0
  }

  /** 列表替换 / 设置变更：硬重置 */
  hardReset(urls, currentIndex, ahead) {
    this.generation++
    this.urls = urls.slice()
    this.currentIndex = currentIndex
    this.ahead = Math.max(1, ahead)
    this.fullPrefetchAllowed = false
    this.queue = []
    this.inFlight.clear()
    this.done.clear()
    this.workerCount = 0
  }

  /**
   * 翻页平移窗口：保留窗口内进行中的下载，只重排待下载队列。
   * 不递增 generation，避免连滑把前方预取掐死。
   */
  updateWindow(urls, currentIndex, ahead) {
    this.urls = urls.slice()
    this.currentIndex = currentIndex
    this.ahead = Math.max(1, ahead)
    this.rebuildQueue()
    this.kickWorkers()
  }

  /** 当前页已完成：放开整窗预取 */
  notifyCurrentLoaded() {
    this.fullPrefetchAllowed = true
    this.rebuildQueue()
    this.kickWorkers()
  }

  /** 当前页加载中：仅保证下一页 */
  notifyAllowNextOnly() {
    this.fullPrefetchAllowed = false
    this.rebuildQueue()
    this.kickWorkers()
  }

  urlAt(index) {
    if (index < 0 || index >= this.urls.length) return ''
    return this.urls[index] || ''
  }

  isNextUrl(url) {
    const next = this.urlAt(this.currentIndex + 1)
    return !!next && next === url
  }

  rebuildQueue() {
    const desired = []
    const pushIdx = (idx) => {
      const url = this.urlAt(idx)
      if (!url) return
      if (desired.includes(url)) return
      desired.push(url)
    }

    // 1) 下一页最高优先
    pushIdx(this.currentIndex + 1)

    if (this.fullPrefetchAllowed) {
      // 2) 回看
      for (let i = 1; i <= FULLSCREEN_PREFETCH_BEHIND; i++) {
        pushIdx(this.currentIndex - i)
      }
      // 3) 更远前方
      for (let i = 2; i <= this.ahead; i++) {
        pushIdx(this.currentIndex + i)
      }
    }

    const nextQueue = []
    for (const url of desired) {
      if (this.done.has(url) || this.inFlight.has(url)) continue
      nextQueue.push(url)
    }
    this.queue = nextQueue
  }

  kickWorkers() {
    const limit = this.fullPrefetchAllowed ? this.maxWorkers : 1
    const gen = this.generation
    while (this.workerCount < limit && this.queue.length > 0) {
      this.workerCount++
      void this.runWorker(gen)
    }
  }

  loadUrl(url) {
    return new Promise((resolve) => {
      if (typeof Image === 'undefined') {
        resolve()
        return
      }
      const img = new Image()
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        resolve()
      }
      img.onload = finish
      img.onerror = finish
      img.src = url
    })
  }

  async runWorker(gen) {
    try {
      while (gen === this.generation) {
        if (this.queue.length === 0) {
          this.rebuildQueue()
        }
        const url = this.queue.shift()
        if (!url) break
        if (this.done.has(url) || this.inFlight.has(url)) continue
        if (!this.fullPrefetchAllowed && !this.isNextUrl(url)) continue

        this.inFlight.add(url)
        try {
          await this.loadUrl(url)
          if (gen === this.generation) {
            this.done.add(url)
          }
        } catch (_e) {
          // 单张失败不阻断
        } finally {
          this.inFlight.delete(url)
        }

        if (gen === this.generation) {
          this.rebuildQueue()
        }
      }
    } finally {
      this.workerCount = Math.max(0, this.workerCount - 1)
      if (gen === this.generation && this.queue.length > 0) {
        this.kickWorkers()
      }
    }
  }
}

/** 根据翻页间隔与跨度计算 ahead */
export function resolvePrefetchAhead(intervalMs, indexDelta) {
  const jump = Math.abs(indexDelta)
  if (jump > 1) return FULLSCREEN_PREFETCH_AHEAD_FAST
  if (intervalMs < PREFETCH_INTERVAL_FAST_MS) return FULLSCREEN_PREFETCH_AHEAD_FAST
  if (intervalMs < PREFETCH_INTERVAL_MID_MS) return FULLSCREEN_PREFETCH_AHEAD_MID
  return FULLSCREEN_PREFETCH_AHEAD_SLOW
}
