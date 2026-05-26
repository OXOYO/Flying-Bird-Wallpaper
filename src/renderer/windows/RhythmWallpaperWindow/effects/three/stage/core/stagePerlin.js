/**
 * 数值平滑工具（纹理球音频 uniform 插值等）。
 * 指数衰减：`smooth` 越大跟随越慢；`dt` 与 `response` 调节帧率无关的响应速度。
 */
export function smoothToward(current, target, smooth, dt = 0.016, response = 1) {
  const k = Math.min(1, (1 - Math.pow(Math.max(0, Math.min(0.99, smooth)), dt * 78)) * response)
  return current + (target - current) * k
}
