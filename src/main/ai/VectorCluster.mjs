/** 向量 K-Means 聚类（余弦距离） */

export function cosineSimilarity(a, b) {
  let dot = 0
  let na = 0
  let nb = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (!na || !nb) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

export function cosineDistance(a, b) {
  return 1 - cosineSimilarity(a, b)
}

function pickInitialCentroids(items, k) {
  const centroids = []
  const used = new Set()
  centroids.push(items[0].vector.slice())
  used.add(0)

  while (centroids.length < k) {
    let bestIdx = -1
    let bestDist = -1
    for (let i = 0; i < items.length; i++) {
      if (used.has(i)) continue
      let minD = Infinity
      for (const c of centroids) {
        minD = Math.min(minD, cosineDistance(items[i].vector, c))
      }
      if (minD > bestDist) {
        bestDist = minD
        bestIdx = i
      }
    }
    if (bestIdx < 0) break
    centroids.push(items[bestIdx].vector.slice())
    used.add(bestIdx)
  }
  return centroids
}

function assignClusters(items, centroids) {
  const groups = centroids.map(() => [])
  for (const item of items) {
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < centroids.length; i++) {
      const d = cosineDistance(item.vector, centroids[i])
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    groups[best].push(item.id)
  }
  return groups
}

function recomputeCentroids(items, groups) {
  const idToVec = new Map(items.map((item) => [item.id, item.vector]))
  return groups.map((memberIds) => {
    if (!memberIds.length) return null
    const dim = items[0].vector.length
    const sum = new Array(dim).fill(0)
    for (const id of memberIds) {
      const vec = idToVec.get(id)
      if (!vec) continue
      for (let i = 0; i < dim; i++) sum[i] += vec[i]
    }
    const n = memberIds.length
    for (let i = 0; i < dim; i++) sum[i] /= n
    const norm = Math.sqrt(sum.reduce((acc, v) => acc + v * v, 0)) || 1
    return sum.map((v) => v / norm)
  })
}

/**
 * @param {{ id: number, vector: number[] }[]} items
 * @param {number} k
 * @returns {{ memberIds: number[] }[]}
 */
export function kMeansCluster(items, k, maxIter = 24) {
  if (!Array.isArray(items) || items.length < 2) return []
  const kk = Math.min(Math.max(1, k), Math.floor(items.length / 2))
  if (kk < 1) return []

  let centroids = pickInitialCentroids(items, kk)
  let groups = assignClusters(items, centroids)

  for (let iter = 0; iter < maxIter; iter++) {
    const nextCentroids = recomputeCentroids(items, groups)
    if (nextCentroids.some((c) => !c)) break
    const nextGroups = assignClusters(items, nextCentroids)
    const unchanged = groups.every(
      (g, i) => g.length === nextGroups[i].length && g.every((id, j) => id === nextGroups[i][j])
    )
    centroids = nextCentroids
    groups = nextGroups
    if (unchanged) break
  }

  return groups
    .map((memberIds) => ({ memberIds: [...memberIds] }))
    .filter((g) => g.memberIds.length > 0)
}
