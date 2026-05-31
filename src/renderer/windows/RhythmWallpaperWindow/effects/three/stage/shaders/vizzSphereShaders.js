/** vizz.fm Textured Sphere（audioReactiveSphere）着色器，源自前端 bundle rP / rI */
export const VIZZ_SPHERE_VERT = `
uniform float time;
uniform float audioData[128];
uniform float sphereSize;
uniform float displacementScale;
uniform float noiseScale;
uniform float noiseIntensity;
uniform float noiseSpeed;
uniform float vertexAudioMix;
uniform float waveIntensity;
uniform float waveFrequency;
uniform float waveSpeed;

varying vec3 vNormal;
varying vec3 vPosition;
varying float vDisplacement;
varying float vLatitude;
varying float vAudioValue;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float perlinNoise(vec3 P) {
  vec3 Pi0 = floor(P);
  vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P);
  vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;
  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);
  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);
  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);
  vec3 g000 = vec3(gx0.x, gy0.x, gz0.x);
  vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
  vec3 g010 = vec3(gx0.z, gy0.z, gz0.z);
  vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
  vec3 g001 = vec3(gx1.x, gy1.x, gz1.x);
  vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
  vec3 g011 = vec3(gx1.z, gy1.z, gz1.z);
  vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);
  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);
  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}

float hash(vec3 p) {
  p = fract(p * vec3(123.34, 234.34, 345.65));
  p += dot(p, p + 34.45);
  return fract(p.x * p.y * p.z);
}

float getLatitudeAudio(vec3 position) {
  float theta = acos(clamp(position.y / length(position), -1.0, 1.0));
  float normalizedTheta = theta / 3.14159265359;
  float distFromEquator = abs(normalizedTheta - 0.5);
  vLatitude = normalizedTheta;
  float arrayPosition = distFromEquator * 2.0 * 127.0;
  int lowerIndex = int(floor(arrayPosition));
  int upperIndex = int(min(127.0, ceil(arrayPosition)));
  float blend = fract(arrayPosition);
  float audioValue = mix(audioData[lowerIndex], audioData[upperIndex], blend);
  float equatorToPoleFactor = sin(theta);
  return mix(audioValue * 1.2, audioValue, equatorToPoleFactor);
}

float getVertexAudio(vec3 position) {
  float vertexHash = hash(position);
  float audioIndex = vertexHash * 127.0;
  int lowerIndex = int(floor(audioIndex));
  int upperIndex = int(min(127.0, ceil(audioIndex)));
  float blend = fract(audioIndex);
  return mix(audioData[lowerIndex], audioData[upperIndex], blend);
}

vec3 calculateWaveDisplacement(vec3 position) {
  vec3 p = normalize(position);
  float theta = acos(clamp(p.y, -1.0, 1.0));
  // 不用 atan(z,x)，避免 SphereGeometry 经线接缝处相位突变
  float wave1 = sin(p.x * waveFrequency * 2.5 + time * waveSpeed);
  float wave2 = cos(p.y * waveFrequency * 2.0 + time * waveSpeed * 0.7);
  float wave3 = sin(p.z * waveFrequency * 2.2 + time * waveSpeed * 1.1);
  float wave4 = sin((p.x + p.z) * waveFrequency * 1.6 + time * waveSpeed * 0.85);
  float combinedWave = (wave1 + wave2 + wave3 + wave4) * 0.25;
  float twistAngle = sin(theta * 3.0 + time * waveSpeed * 0.5) * 0.35;
  vec3 tangent = cross(vec3(0.0, 1.0, 0.0), p);
  if (dot(tangent, tangent) < 1e-4) tangent = vec3(1.0, 0.0, 0.0);
  tangent = normalize(tangent);
  vec3 displacementDir = normalize(p + tangent * twistAngle);
  return displacementDir * combinedWave * waveIntensity;
}

void main() {
  vPosition = position;
  vec3 scaledPosition = position * sphereSize;
  float latitudeAudio = getLatitudeAudio(scaledPosition);
  float vertexAudio = getVertexAudio(scaledPosition);
  float audio = mix(latitudeAudio, vertexAudio, vertexAudioMix);
  vAudioValue = audio;
  vec3 radialDirection = normalize(position);
  vec3 noisePos = scaledPosition * noiseScale + time * noiseSpeed;
  float noise = perlinNoise(noisePos);
  vec3 waveDisplacement = calculateWaveDisplacement(scaledPosition);
  float audioDisplacement = audio * displacementScale + noise * noiseIntensity;
  vec3 newPosition = position + radialDirection * audioDisplacement + waveDisplacement;
  vDisplacement = audioDisplacement + length(waveDisplacement);
  vNormal = normalize(newPosition);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`

import { RHYTHM_PALETTE_GLSL } from './rhythmPaletteGLSL.js'

export const VIZZ_SPHERE_FRAG = `
${RHYTHM_PALETTE_GLSL}

uniform float time;
uniform float colorIntensity;

varying vec3 vNormal;
varying vec3 vPosition;
varying float vDisplacement;
varying float vLatitude;
varying float vAudioValue;

void main() {
  float d = clamp(vDisplacement * colorIntensity, 0.0, 1.0);
  // vizz heatmap：绕 Y 轴径向，赤道 dist=0，两极 dist=1（非上下线性渐变）
  float radialT = abs(vLatitude - 0.5) * 2.0;
  float spikeT = clamp(vDisplacement * colorIntensity, 0.0, 1.0);
  float t = mix(radialT, spikeT, 0.18);
  vec3 heatColor = rhythmPalette(t);
  vec3 color = mix(heatColor * 0.22, heatColor, clamp(d * 2.0, 0.0, 1.0));
  color += d * 0.18;
  color += vAudioValue * 0.06 * rhythmPalette(clamp(vAudioValue, 0.0, 1.0));
  vec3 n = normalize(vNormal);
  float shade = 0.5 + 0.5 * max(0.0, dot(n, normalize(vec3(0.2, 0.88, 0.4))));
  color *= shade;
  color += 0.03 * sin(time * 2.0) * heatColor;
  gl_FragColor = vec4(color, 1.0);
}
`
