<div align="center">

# Awesome MiniMax H3

### MiniMax H3 / 海螺 Hailuo 3.0 真实视频案例与公开 Prompt 原文

[在线案例库](https://h3-field-notes-production.up.railway.app/) · [工具链](https://h3-field-notes-production.up.railway.app/toolkit/) · [常见问题](https://h3-field-notes-production.up.railway.app/faq/) · [English](./README.md) · [参与贡献](./CONTRIBUTING.md)

</div>

![H3 Field Notes 网站](./public/og-image.jpg)

Awesome MiniMax H3 是一个带来源追踪的开源 AI 视频案例库，覆盖 **MiniMax H3**、**Hailuo 3.0**、文字生视频、首尾帧视频、全模态参考视频、视频编辑、原生音频、运镜、对白、口型与角色一致性等高意图检索词。

项目由三部分组成：案例优先的中英双语网站、机器可读数据，以及使用 Mac 登录态浏览器自动发现 X 案例的审核流程。公开案例都保留原始来源。只有原作者或官方公开脚本逐字发布了 Prompt，网站才呈现该原文；原帖未公开时会明确标注没有公开 Prompt。项目绝不根据视频生成、改写、重建、反推或拆解提示词。不确定内容只进入候选队列，不会超时自动发布。

当前共有 32 个公开案例：3 个来自 MiniMax 官方公开脚本的案例，以及 29 个经人工批准的 X 社区案例，覆盖公开 Prompt 原文、本地 ComfyUI 性能测试、图片与多模态参考、模型对比、音乐视频、多镜头短片、原生音频和后期工作流。X 案例通过官方嵌入播放器在站内直接播放；确实无法嵌入时，可在留存许可记录后启用自托管兜底。

## 核心内容

| 资源 | 用途 |
| --- | --- |
| [可视化案例库](https://h3-field-notes-production.up.railway.app/) | 按生成模式、分类、风格、场景和关键词筛选 |
| [`data/cases.json`](./data/cases.json) | 带来源与核验状态的视频案例、公开 Prompt 原文记录和元数据 |
| [`CATALOG.md`](./CATALOG.md) | GitHub 原生案例索引 |
| [`agents/skills/minimax-h3-prompt-library`](./agents/skills/minimax-h3-prompt-library/) | 用于检索案例与公开 Prompt 原文的 Agent Skill；不负责写提示词 |

## H3 工具链与部署入口

| 资源 | 先看什么 | 地址 |
| --- | --- | --- |
| MiniMax H3 官方仓库 | 权重、部署说明，以及包括 `h3-prompt-writing` 在内的 9 个 Agent Skill | [MiniMax-AI/MiniMax-H3](https://github.com/MiniMax-AI/MiniMax-H3) |
| MiniMax-H3 Turbo LoRA | 4–8 步同步音视频加速；4 步预览，v4 在 6–8 步通常更稳 | [larryvrh/MiniMax-H3-Turbo-Lora](https://huggingface.co/larryvrh/MiniMax-H3-Turbo-Lora) |
| ComfyUI H3 Motion Context | 多片段续接，延续上一段的画面运动与音频上下文 | [NikoDemon80/ComfyUI-H3-Motion-Context](https://github.com/NikoDemon80/ComfyUI-H3-Motion-Context) |
| MiniMax H3 Audio T8 | 原生 H3 音频条件、双时钟采样、混音、裁切、预检与 Ref2VA 工作流 | [T8mars/comfyui-minimax-h3-audio-T8](https://github.com/T8mars/comfyui-minimax-h3-audio-T8) |

实践路线优先尝试 **Turbo LoRA + SageAttention**。EasyCache 更适合原生 20 步链路，不建议和 4 步 Turbo 叠加；采样步数的缩短也不等于端到端等比例加速，VAE 解码和视频封装仍会占用时间。这些外部部署资源与案例档案分开维护；案例库不会从收录视频中派生提示词或制作流程。

## 自动采集路线

```text
X 登录态浏览器搜索
        ↓
原帖链接 + 公开元数据
        ↓
规则去重与初筛
        ↓
MiMo V2.5 Pro 公开文本分类
        ↓
仅入围视频 → MiMo V2.5 低 FPS 核验
        ↓
data/candidates.json
        ↓
人工确认
        ↓
data/cases.json → 网站 / GitHub / Agent Skill
```

这条路线不需要 X API Token，但需要 Mac 上现有的 X 登录态。任务不会绕过登录限制或直接公开候选案例；发现阶段只记录公开元数据，只有原帖逐字展示 Prompt 时才复制原文，绝不让模型补写或反推。发布阶段优先使用官方 X 嵌入，无法嵌入时才进入许可明确的媒体兜底流程。详细规则见 [`docs/DISCOVERY_WORKFLOW.md`](./docs/DISCOVERY_WORKFLOW.md)。

## 模型与密钥

只使用现有小米 MiMo Token Plan：

- `mimo-v2.5-pro`：对原帖公开文本和元数据做分类，不生成、不改写、不推断 Prompt；
- `mimo-v2.5`：对入围视频与音频做有限核验，不用于重建提示词或拆解工作流。

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
- Prompt 仅在原作者或官方公开脚本逐字发布时收录，并保持原文不变；
- 原帖未公开 Prompt 时不生成、不补全、不翻译成原文、不改写、不重建、不反推、不拆解，明确标注为未公开；
- 默认使用官方 X 嵌入；只有许可记录明确且嵌入不可用时才重托管创作者视频；
- 不确定项始终留在审核队列；
- 创作者可通过 Issue 请求纠错或移除。

代码使用 MIT License。视频、提示词、姓名和其他收录内容仍受原权利人与来源平台条款约束。本项目与 MiniMax 无隶属关系。
