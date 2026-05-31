/** vizz Mesh Grid 使用的 3D Perlin 查表（从 vizz.fm 前端 bundle 还原） */
const PERM = new Uint8Array(512)

function initPermutation() {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    const t = p[i]
    p[i] = p[j]
    p[j] = t
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function grad3(hash, x, y, z) {
  const h = hash & 15
  const u = h < 8 ? x : y
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
}

let ready = false
function ensureReady() {
  if (!ready) {
    initPermutation()
    ready = true
  }
}

/** 近似 vizz 内联 perlin 采样，输出约 [-1,1] */
export function vizzPerlin3(x, y, z) {
  ensureReady()
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  const Z = Math.floor(z) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const zf = z - Math.floor(z)
  const u = fade(xf)
  const v = fade(yf)
  const w = fade(zf)

  const A = PERM[X] + Y
  const AA = PERM[A] + Z
  const AB = PERM[A + 1] + Z
  const B = PERM[X + 1] + Y
  const BA = PERM[B] + Z
  const BB = PERM[B + 1] + Z

  return lerp(
    lerp(
      lerp(grad3(PERM[AA], xf, yf, zf), grad3(PERM[BA], xf - 1, yf, zf), u),
      lerp(grad3(PERM[AB], xf, yf - 1, zf), grad3(PERM[BB], xf - 1, yf - 1, zf), u),
      v
    ),
    lerp(
      lerp(grad3(PERM[AA + 1], xf, yf, zf - 1), grad3(PERM[BA + 1], xf - 1, yf, zf - 1), u),
      lerp(grad3(PERM[AB + 1], xf, yf - 1, zf - 1), grad3(PERM[BB + 1], xf - 1, yf - 1, zf - 1), u),
      v
    ),
    w
  )
}

export function smoothToward(current, target, smooth, dt = 0.016, response = 1) {
  const k = Math.min(1, (1 - Math.pow(Math.max(0, Math.min(0.99, smooth)), dt * 78)) * response)
  return current + (target - current) * k
}
