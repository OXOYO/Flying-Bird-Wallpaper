# 舞台子模块（`effects/three/stage`）

| 目录 | 职责 |
|------|------|
| `core/` | 舞台基类、频谱映射、律动驱动、平滑插值 |
| `wall/` | 墙面矩阵、地面光晕 |
| `floorGrid/` | 地板柱阵 |
| `sphere/` | 纹理球体可视化 |
| `room/` | 霓虹盒房间壳体 |
| `shaders/` | 球体 / 调色板 GLSL |

入口效果类在 `../stages/ThreeStage*.js`；共享配色与房间盒在 `../stageColorTheme.js`、`../StageRoomBox.js`。

各 `.js` 文件顶部有模块说明；复杂算法（频谱映射、相机 fit、追光）在函数旁有中文注释。
