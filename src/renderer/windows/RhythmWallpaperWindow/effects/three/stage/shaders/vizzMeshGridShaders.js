import { RHYTHM_PALETTE_GLSL } from './rhythmPaletteGLSL.js'

/** vizz.fm mesh-grid 线框顶点着色器 */
export const VIZZ_MESH_GRID_VERT = `
attribute float frequency;
attribute float displacement;
varying vec3 vPosition;
varying float vFrequency;
varying float vElev;

void main() {
  vPosition = position;
  vFrequency = frequency;
  vElev = displacement;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/** 片元：位移为主进暖色，仅尖峰/强点泛红，避免大面积红 */
export const VIZZ_MESH_GRID_FRAG = `
${RHYTHM_PALETTE_GLSL}

uniform float time;
uniform float colorIntensity;
uniform float circleMode;
uniform float gridHalfX;
uniform float gridHalfZ;
uniform float peakLift;
varying vec3 vPosition;
varying float vFrequency;
varying float vElev;

void main() {
  if (circleMode > 0.5) {
    float nx = vPosition.x / gridHalfX;
    float ny = vPosition.y / gridHalfZ;
    if (nx * nx + ny * ny > 1.0) discard;
  }
  float elev = peakLift > 0.001 ? clamp(vElev / peakLift, 0.0, 1.0) : 0.0;
  float tColor = elev;
  vec3 color = rhythmPalette(tColor);
  color *= 0.78 + 0.1 * colorIntensity;
  color = min(color, vec3(0.82));
  gl_FragColor = vec4(color, 0.88);
}
`
