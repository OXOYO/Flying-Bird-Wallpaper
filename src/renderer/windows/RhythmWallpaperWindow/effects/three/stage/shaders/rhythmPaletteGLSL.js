/** 着色器内按律动配色插值（与 heightColorHex 一致：低→首色，高→末色） */
export const RHYTHM_PALETTE_GLSL = `
uniform vec3 uColors[8];
uniform int uColorCount;

vec3 rhythmPalette(float t) {
  float clamped = clamp(t, 0.0, 1.0);
  if (uColorCount <= 1) return uColors[0];
  float pos = clamped * float(uColorCount - 1);
  int i0 = int(floor(pos));
  int i1 = min(uColorCount - 1, i0 + 1);
  float f = fract(pos);
  return mix(uColors[i0], uColors[i1], f);
}
`
