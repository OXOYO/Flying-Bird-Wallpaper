# docs/temp 文档索引

> 说明：本目录为**开发过程临时文档**，与正式用户文档（`docs/` 根目录）区分。  
> 正式 AI 能力说明见 [ai-features.md](../ai-features.md)。

---

## AI 与 Prompt 工程

| 文档                                                                   | 用途                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [ai-prompt-skills-architecture.md](./ai-prompt-skills-architecture.md) | Skill Pack、**schema + normalize**（§3.7 与 Cursor Rules 区别）、Prompt 单语源 |
| [ai-skill-packs-reference.md](./ai-skill-packs-reference.md)           | **8 个 Skill Pack 逐项说明**（字段、normalize、入口、示例）                    |

**阅读建议**：

- 「当前 AI 链路怎么走」→ [ai-prompt-skills-architecture.md §1.2](./ai-prompt-skills-architecture.md)
- 「rules.json 和 Cursor Rules 有何不同」→ 架构文档 **§3.7**
- 「Rules 是否应写死在 Parser」→ §2、§3.2：**normalize.json + schema，Parser 仅兼容层**
- 「8 个 Pack 字段与 normalize」→ [ai-skill-packs-reference.md](./ai-skill-packs-reference.md)

---

## 代码锚点（AI Prompt 相关）

| 模块              | 路径                                                                               |
| ----------------- | ---------------------------------------------------------------------------------- |
| Prompt 构建       | `src/main/ai/AiPrompts.mjs`                                                        |
| Provider          | `src/main/ai/AiAnalysisProvider.mjs`                                               |
| Rules / normalize | `src/main/ai/AiResponseParser.mjs`                                                 |
| 文本解析          | `src/main/ai/TextQueryParser.mjs`                                                  |
| 系统策展          | `src/main/store/CollectionCurator.mjs`                                             |
| NormalizeEngine   | `src/main/ai/normalize/NormalizeEngine.mjs`                                        |
| Schema coerce     | `src/main/ai/normalize/schemaCoerce.mjs`                                           |
| 离线重放          | `src/main/ai/AiNormalizeReplay.mjs`                                                |
| Pack 路径解析     | `src/main/ai/skills/skillPackPaths.mjs`                                            |
| Skill Pack 加载   | `src/main/ai/skills/SkillPackLoader.mjs`                                           |
| Skill Pack 资源   | `resources/ai/skills/`（打包：`electron-builder.yml` → `extraResources` 整包复制） |

---

## 修订记录

| 日期           | 说明                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **2026-06-08** | 初版成稿：`ai-prompt-skills-architecture.md`、`ai-skill-packs-reference.md`、本索引；对齐 Skill Pack Phase A/B/D 实现、schemaCoerce、i18n 清理、测试脚本路径 |
