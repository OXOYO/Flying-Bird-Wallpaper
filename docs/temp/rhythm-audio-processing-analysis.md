# 律动壁纸：音频处理逻辑与「节奏感」差异分析

> 临时文档，供后续改造参考。描述当前实现逻辑、与「音乐节奏」目标的差距，以及建议的信号架构。  
> 正式实现文档见 [rhythm_wallpaper.md](../rhythm_wallpaper.md)。

---

## 1. 背景与问题

### 1.1 产品目标

律动壁纸希望体现**音乐的节奏**——鼓点、重拍上的顿挫、强弱起伏，而不是「音乐一响柱子就一直抖」。

### 1.2 当前体感（常见反馈）

- 画面更像**均衡器 / 频谱可视化**，随旋律线连续变化；
- 缺少「**一拍一冲**」再回落的感觉；
- 静音或弱段仍有细微抖动（底噪、高频细节驱动）；
- 调整「动效曲线」「采样范围」后改善有限。

### 1.3 结论（一句话）

**现有链路 = 实时频谱能量可视化 + 响度曲线整形；目标链路 = 低频包络 + 瞬态检测 + 节拍脉冲状态，再驱动视觉。**

---

## 2. 现有数据流（as-is）

```text
虚拟声卡 / 环回设备
  → MediaStreamSource
  → AnalyserNode（fftSize = 1024，frequencyBinCount = 512）
  → getByteFrequencyData（每帧 0–255 字节幅度）
  → rhythmSampleRange 按百分比 slice 截取频段
  → 各效果 EffectBase：
        getReducedValues（分段 max / average / min，默认 max）
        getMappedValues / getMappedValue（rhythmAnimation 曲线）
  → 映射到柱高、半径、透明度、粒子数、旋转速度等
  → requestAnimationFrame 循环
```

### 2.1 关键代码位置

| 环节 | 文件 |
|------|------|
| 采集与绘制循环 | `src/renderer/windows/RhythmWallpaperWindow/containers/RhythmWallpaperWindow.vue` |
| 降维、响度映射 | `src/renderer/windows/RhythmWallpaperWindow/effects/base/EffectBase.js` |
| Leafer / Three 效果 | `src/renderer/windows/RhythmWallpaperWindow/effects/leafer/*`、`effects/three/*` |
| 默认配置 | `src/common/publicData.js`（`rhythmAnimation`、`rhythmSampleRange` 等） |

### 2.2 采集层细节

- **仅使用频域**：`getByteFrequencyData`，未使用 `getByteTimeDomainData` 做整体响度包络。
- **FFT 配置**：`fftSize = 1024`，约 512 个频点；未在文档化配置中显式设置 `smoothingTimeConstant`、`minDecibels`、`maxDecibels`（使用浏览器默认，内置平滑会削弱瞬态）。
- **设备选择**：按虚拟声卡关键词优先级尝试 `getUserMedia`（VB-Audio、BlackHole、立体声混音等）。

### 2.3 「滤波」在项目中的真实含义

项目中**没有**经典 DSP 意义上的低通 / 高通 / FIR / IIR 滤波器，而是：

| 步骤 | 作用 | 是否等于「跟拍子」 |
|------|------|-------------------|
| `sampleRange` 截取 | 频域子带选择（听哪一段频率） | 否，仅限制频段 |
| `getReducedValues` | 将长频谱压成 N 段，段内 max/avg/min | 否，描述分段能量形状 |
| `getMappedValue`（rhythmAnimation） | 0–255 → 0–1 的非线性曲线 | 否，仅改变响度显示曲线 |
| 效果内 `energy` 门限（如 `< 0.02`） | 静音时隐藏或减弱 | 部分相关，仍是平均响度 |
| `ThreeBar` 柱高插值（α≈0.1） | 帧间平滑，减少闪烁 | 会削弱拍点顿挫 |
| `LeaferRainbow` 的 `lastScale` EMA | 缩放平滑 | 同上 |

设置项 `rhythmAnimation`（线型、对数、抛物线、平方根、指数、正弦、弹跳、阶梯）在代码注释与 UI 上偏「动效曲线」，本质是**显示增益**，不是节拍检测算法。

---

## 3. 听感上的「节奏」vs 当前在算的量

| 听感上的节奏 | 当前实现主要在算 |
|--------------|------------------|
| 鼓点、拍子何时落下 | 各频段此刻有多响（频谱幅度） |
| 强弱起伏、顿挫 | 分段 max + 抛物线等映射 |
| 全曲同步的「一下一下」 | 各频段独立反应，易连续乱动 |
| 静音段几乎不动 | 底噪与高频细节仍会带动微动 |

人耳对节奏的感知主要来自：

1. **低频冲击**（底鼓、大鼓、重低音）；
2. **响度突变**（onset：相对上一帧的瞬态上升）；
3. **周期性**（BPM，约 60–180 BPM，可选进阶）。

当前主路径没有显式计算 (2) 与 (3)，也没有统一的「节拍脉冲」状态。

---

## 4. 为何现有逻辑难以体现节奏

### 4.1 信息源

频谱每一帧都在变：人声、镲片、合成器亮部都会抬高对应频段 → 视觉**连续变化**，缺少「仅在拍点上冲一下」的结构。

### 4.2 聚合方式

`getReducedValues(..., 'max')` 表示「这一段里峰值是多少」，跟踪的是**频谱形状峰值**，不是「这一刻是否比上一刻突然更响」。

### 4.3 缺少节拍状态机

没有如下状态：

```text
检测到一拍 → beat = 1 → 逐帧衰减（如 beat *= 0.9）→ 弱拍/间隙接近 0
```

因此效果无法与鼓点时间对齐，只能跟瞬时频谱走。

### 4.4 低频与瞬态未分离

底鼓（低频短脉冲）与镲片（高频持续）共用同一套柱高/能量逻辑，难以**主要跟鼓点**。

### 4.5 典型听感对比

| 模式 | 听感 / 观感 |
|------|-------------|
| 当前 | 均衡器柱子随音乐上下跳 |
| 目标 | 灯光/粒子在鼓点或重拍上顿一下，弱段收住 |

---

## 5. 现有 `EffectBase` 数据处理（摘录逻辑）

### 5.1 降维 `getReducedValues(list, count, type)`

- 将 `list.length` 等分为 `count` 段；
- `max`（默认）：`Math.max(...slice)`，突出段内峰值；
- `average`：段内算术平均，相对平滑；
- `min`：段内最小值。

多数 Leafer 效果：`getMappedValues(getReducedValues(dataArray, barCount))`。

部分 Three 效果：先 `getMappedValues` 再 `getReducedValues(..., 'max')`。

### 5.2 映射 `getMappedValue(value)`（`rhythmAnimation`）

| 模式 | 行为概要 |
|------|----------|
| `linear` | `value / 255` |
| `log` | 压低高电平、抬高低电平 |
| `parabola`（默认） | `(v/255)²`，弱音更弱 |
| `sqrt` | 弱音相对放大 |
| `exp` | `(v/255)^1.5` |
| `sin` | 前半缓、后半陡 |
| `bounce` | CSS 弹跳曲线 + 指数压缩 |
| `step` | 5 档量化 |

### 5.3 效果层对「能量」的用法

部分效果计算：

```text
energy = mean(getMappedValues(...))
if (energy < 0.02) → 不绘制或减弱
```

这是**映射后频谱的平均响度**，不是 onset/beat 检测。  
柱高类效果（如 `LeaferBar`）多为**每帧直接赋值**，无统一节拍包络。

---

## 6. 建议目标架构（to-be，概念层）

### 6.1 双通道信号

| 通道 | 用途 | 建议来源 |
|------|------|----------|
| **律动驱动**（beat / pulse） | 全局缩放、闪动、喷发、加速 | 低音 + 频谱突变 + 不应期 |
| **纹理细节**（spectrum） | 柱形、波形、颜色分布 | 保留现有 FFT + 降维 |

原则：**拍子决定「动多少」，频谱决定「长什么样」。**

### 6.2 律动驱动应包含的量

#### （1）低音能量 Bass

- 取频谱前约 **10%–15%** 频点（或与 `sampleRange` 左端对齐）；
- **包络跟随**：起音快（attack）、释音慢（release），贴近底鼓「咚」的起伏。

#### （2）瞬态 Onset（Spectral Flux）

- 当前帧与上一帧频谱，对**正向差分**求和并归一化；
- 突变大 ≈ 新音符或鼓点落下，比静态「有多响」更贴节奏。

#### （3）节拍脉冲 Beat Pulse

- 当 `onset` 或 `bass` 超过**自适应阈值**（随近期均值漂移），且距上一拍 **≥ 约 120–180ms**（降低一倍频误触），置 `beat = 1`；
- 每帧 `beat *= 0.85 ~ 0.92` 衰减，形成可见「顿一下」。

#### （4）整体强度 Energy

- 例如：`energy = f(bass, flux, beat)`，用于静音门限、全局缩放；
- 可替代或补充「映射频谱均值」。

### 6.3 与现有模块的衔接方式（设计建议）

| 现有模块 | 节奏改造中的角色 |
|----------|------------------|
| `sampleRange` | 律动通道建议默认偏**低频**；纹理仍可用全谱或中高频 |
| `rhythmAnimation` | 更适合作为 **beat/bass 包络的输出曲线**，而非直接作用每个频点 |
| `getReducedValues` | 保留用于**形状**；律动可用**统一乘子**或单独 `beat` 驱动各段 |
| `rhythmDensity` | 只改变柱/点数量，不解决是否跟拍 |

### 6.4 可选进阶

- **BPM 估计**：对 beat 时间戳自相关，稳定周期性闪烁（实现成本高）；
- **时域 RMS**：`getByteTimeDomainData` 得整体响度，与 bass 融合，适配低频不明显的曲风；
- **产品双模式**：「频谱模式」（现状）、「节奏模式」（beat 驱动），便于 A/B 与回退。

---

## 7. 与现有用户设置的关系

| 设置项 | 对节奏感的作用 | 局限 |
|--------|----------------|------|
| `rhythmSampleRange` | 收窄频段可略贴近鼓 | 无 onset/beat |
| `rhythmAnimation` | 改变强弱对比 | 不产生拍点 |
| `rhythmDensity` | 视觉密度 | 与拍无关 |
| `rhythmEffect` / 颜色 / 位置 | 表现层 | 与算法无关 |

**仅调现有设置、不增加节拍状态层，很难从根上变成「跟拍子」。**

---

## 8. 建议实施阶段（仅规划，非承诺排期）

### 阶段 A：中央律动处理器（不改各效果签名也可先做）

- 在 `RhythmWallpaperWindow` 的 `draw` 循环内，于 `render` 之前计算 `{ bass, flux, beat, energy, onset }`；
- 输出「节拍调制后的频谱」或把 `rhythm` 挂到 `effectInstance` 供读取；
- 采集层：适当降低 `smoothingTimeConstant`，保留瞬态。

### 阶段 B：效果层统一消费

- `EffectBase` 提供 `getRhythmEnergy()` / `getRhythmBeat()`；
- 将现有 `energy = mean(mappedValues)` 改为优先节奏能量（或 `max(spectrum, rhythm)`）；
- 柱高类：`height *= (base + beat * gain)`，使多柱同步顿挫。

### 阶段 C：设置与文档

- 可选「反应模式」：频谱 / 节奏；
- 更新 `rhythm_wallpaper.md` 与设置页说明；
- 调参：`minBeatInterval`、attack/release、低频比例。

---

## 9. 验证建议（改造后）

1. **强鼓点曲**：鼓点时刻全局缩放/喷发明显，弱拍间隙明显收住；
2. **纯人声**：不应每字都误触发为「重拍」（阈值与低频权重需调）；
3. **静音**：`energy` 长期低于门限，画面静止；
4. **参数缺失 / 无虚拟声卡**：保持现有通知与兜底，不白屏；
5. **切换效果 / 修改 sampleRange**：节奏状态机 `reset`，避免上一曲残留。

---

## 10. 相关文档

- [律动壁纸（现有实现说明）](../rhythm_wallpaper.md)
- [渲染进程说明](../renderer_process.md)（RhythmWallpaperWindow 章节）

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-25 | 初稿：现状分析 + 节奏目标架构 + 分阶段建议 |
