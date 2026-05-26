# 律动壁纸

律动壁纸通过 Web Audio API 捕获系统音频，由 **Three.js 舞台效果** 渲染音频响应画面，实现桌面律动背景。

实现目录：`src/renderer/windows/RhythmWallpaperWindow/`（窗口、`rhythmAudio`、`effects/three`）。

---

## 架构

```
系统音频 → Web Audio API → rhythmAudio.getFrame() → Three 舞台效果 → 桌面律动壁纸
```

- **窗口**：`RhythmWallpaperWindow`（透明、点击穿透、桌面层级）
- **音频**：`utils/rhythmAudio.js`，虚拟声卡优先（VB-Audio、BlackHole、立体声混音等）
- **效果**：`effects/three/stages/ThreeStage*.js`，基类 `StageEffectBase` → `ThreeStageBase`
- **配置迁移**：`utils/resolveRhythmEffect.js`（旧 Leafer / 已删效果名映射到当前 Three 效果）

---

## 当前效果（4 种）

| 配置值 | 说明 |
|--------|------|
| `ThreeStageBars` | 演唱会柱 + 追光（默认） |
| `ThreeStageWall` | 霓虹墙矩阵 |
| `ThreeStageGrid` | 地柱网格 |
| `ThreeStageTexturedSphere` | 纹理球体 |

选项与默认值见 `src/common/publicData.js` 的 `rhythmEffectOptions`、`rhythmEffect`。

---

## 子模块（`effects/three/stage/`）

| 目录 | 职责 |
|------|------|
| `core/` | 频谱映射、律动驱动、舞台基类 |
| `wall/` | 墙面矩阵、地面光晕 |
| `floorGrid/` | 地板柱阵 |
| `sphere/` | 纹理球 |
| `room/` | 霓虹盒房间壳体 |
| `shaders/` | GLSL（球体、调色板） |

共享：`stageColorTheme.js`、`StageRoomBox.js`、`stageLayoutProfile.js`。

---

## 配置项

- 效果类型、宽高比例、配色、动画曲线、密度、位置、采样范围等（设置页与 `settingData` 同步）

---

## 已移除（仅兼容旧配置）

- **Leafer 2D** 及全部 `Leafer*` 效果名 → 映射为 `ThreeStageBars`
- 实验性 Three（`ThreeBar`、`ThreeWave` 等）、泳池、**线框地形**（`ThreeStageMeshGrid` / `ThreeStageRoomMeshGrid`）→ 见 `resolveRhythmEffect.js`

---

## 平台差异

- **Windows**：`koffi` 设置桌面级窗口；可配合纯色动态壁纸
- **macOS**：`desktop` 类型窗口、全工作区可见
- **Linux**：标准透明窗口（依赖窗口管理器）

更细的窗口与进程说明见 `docs/renderer_process.md` 中「律动壁纸窗口」一节。
