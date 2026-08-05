<div align="center">

# Awesome MiniMax H3

### MiniMax H3 / 海螺 Hailuo 3.0 视频案例、提示词模板与可复现工作流

[在线案例库](https://h3-field-notes-production.up.railway.app/) · [English](./README.md) · [案例目录](./CATALOG.md) · [参与贡献](./CONTRIBUTING.md)

</div>

![H3 Field Notes 网站](./public/og-image.jpg)

Awesome MiniMax H3 是一个带来源追踪的开源 AI 视频提示词案例库，覆盖 **MiniMax H3**、**Hailuo 3.0**、文字生视频、首尾帧视频、全模态参考视频、视频编辑、原生音频、运镜、对白、口型与角色一致性等高意图检索词。

项目由四部分组成：可筛选的网站、Prompt-as-Code 模板、机器可读数据，以及使用 Mac 登录态浏览器自动发现 X 案例的审核工作流。公开案例都保留原始来源和提示词来源类型；不确定内容只进入候选队列，不会超时自动发布。

## 核心内容

| 资源 | 用途 |
| --- | --- |
| [可视化案例库](https://h3-field-notes-production.up.railway.app/) | 按生成模式、分类、风格、场景和关键词筛选 |
| [`data/cases.json`](./data/cases.json) | 已核验的结构化视频案例与提示词 |
| [`data/templates.json`](./data/templates.json) | 从已核验案例提炼的可复用提示词模板 |
| [`CATALOG.md`](./CATALOG.md) | GitHub 原生案例索引 |
| [`agents/skills/minimax-h3-prompt-library`](./agents/skills/minimax-h3-prompt-library/) | 用于检索和改写提示词的 Agent Skill |

## 自动采集路线

```text
X 登录态浏览器搜索
        ↓
原帖链接 + 公开元数据
        ↓
规则去重与初筛
        ↓
MiMo V2.5 Pro 文本提取 / 分类
        ↓
仅入围视频 → MiMo V2.5 低 FPS 核验
        ↓
data/candidates.json
        ↓
人工确认
        ↓
data/cases.json → 网站 / GitHub / Agent Skill
```

这条路线不需要 X API Token，但需要 Mac 上现有的 X 登录态。任务不会绕过登录限制、搬运受限媒体或直接公开候选案例。详细规则见 [`docs/DISCOVERY_WORKFLOW.md`](./docs/DISCOVERY_WORKFLOW.md)。

## 模型与密钥

只使用现有小米 MiMo Token Plan：

- `mimo-v2.5-pro`：提示词提取、分类和文本推理；
- `mimo-v2.5`：入围视频与音频的多模态核验。

真实密钥只放本机 `.env` 或受保护的服务端 Secret；不会写进前端、GitHub 仓库或构建产物。公开网站本身完全不需要 API Key。

## 本地运行

需要 Node.js 22+：

```bash
npm install
npm run dev
```

完整检查：

```bash
npm test
npm run lint
npm run validate:data
npm run build
npm run catalog
```

构建过程会生成独立案例页、`VideoObject` 结构化数据、视频 Sitemap、Open Graph 元数据、`robots.txt` 和 `llms.txt`，兼顾传统 SEO 与面向 AI 搜索/答案引擎的 GEO 可发现性。

## Railway 自动部署

线上站点运行于 Railway。Railway 追踪公开 GitHub 仓库的 `main` 分支；合并或推送到主分支后会自动构建并更新。手动部署只作为故障排查时的兜底。

## 数据与版权原则

- 只收录能追溯原作者与原始链接的案例；
- 不推断私有提示词，重构内容必须标注 `reconstructed`；
- 未经授权不重托管创作者视频；
- 不确定项始终留在审核队列；
- 创作者可通过 Issue 请求纠错或移除。

代码使用 MIT License。视频、提示词、姓名和其他收录内容仍受原权利人与来源平台条款约束。本项目与 MiniMax 无隶属关系。
