# 元协坊 · EduChat

一款基于 React + Vite + Express + MongoDB 构建的智能体协作平台，具有智能体单聊、图片生成、音乐生成和智能体协作群聊等功能。

## Docker 部署

1. 准备生产环境变量（不要把真实密钥提交到仓库）：
   - node 版本：20.x
   - `npm install`
   - `cp .env.example .env`
   - 修改 `.env` 中的 API Key、`AUTH_SECRET`、Mongo 账号密码相关变量
   - 如需挂在子路径下：配置 `EDUCHAT_BASE_PATH`，例如 `EDUCHAT_BASE_PATH=/hznu/metaxfang/`
   - 如需使用 PackyCode：配置 `PACKYCODE_API_KEY`；可选覆盖 `PACKYCODE_CHAT_ENDPOINT`，默认使用 `https://www.packyapi.com/v1/chat/completions`
   - 如需使用 MiniMax 原生聊天、歌词生成与音乐生成：配置 `MINIMAX_API_KEY`；可选覆盖 `MINIMAX_CHAT_ENDPOINT`、`MINIMAX_MUSIC_ENDPOINT` 与 `MINIMAX_LYRICS_ENDPOINT`
   - 如启用文件 OSS 存储：配置 `ALIYUN_OSS_*` 与 `ALIYUN_ACCESS_KEY_*`；公共读桶请设 `ALIYUN_OSS_PUBLIC_READ=true`，私有桶保持 `false`；网络路由建议使用 `ALIYUN_OSS_NETWORK_MODE`：`public`（本地）/`internal_prefer`（ECS 生产）/`internal_only`（严格内网）。`ALIYUN_OSS_INTERNAL` 仍兼容旧配置
   - 默认启用启动自检（Bucket 可达性 + 写删探测），可通过 `ALIYUN_OSS_STARTUP_CHECK_*` 开关调整
2. 启动服务：
   - `docker compose up -d --build`
3. 查看状态：
   - `docker compose ps`
   - `docker compose logs -f app`

## 本地部署

1. 安装依赖：
   - `npm install`
2. 配置环境变量：
   - `cp .env.example .env`
   - 至少配置一个 provider 的 API Key；若使用 PackyCode，请设置 `PACKYCODE_API_KEY`；若使用 MiniMax，请设置 `MINIMAX_API_KEY`
   - 如需本地模拟子路径部署，可额外设置 `EDUCHAT_BASE_PATH=/hznu/metaxfang/`
3. 启动服务：
   - `npm run dev`

## 固定公开 Agent

- `Agent A (GPT-5.4)` → `packycode / gpt-5.4`
- `Agent B (MiniMax-M2.7)` → `minimax / MiniMax-M2.7`
- `Agent C (Distance Education)` → `volcengine / doubao-seed-2-0-pro-260215`
- `Agent D (Qwen-3.5)` → `aliyun / qwen3.5-plus`
- 新建聊天时必须先选择 agent；选定后会在整个会话生命周期内锁定，不支持会话中途切换

## PackyCode Provider

- `provider` 使用 `packycode`
- 默认模型为 `gpt-5.4`
- 默认推理强度为 `medium`
- 当前仅接入标准 OpenAI 兼容 `chat/completions`
- 当前不支持联网搜索、OpenRouter 插件、Responses API 与 Packy 专属扩展能力

## MiniMax Provider

- 文本对话与音乐生成均直接走 MiniMax 原生 HTTP 接口，不依赖 `Anthropic SDK`
- 聊天 provider 默认使用 `MINIMAX_CHAT_ENDPOINT`，缺省值为 `https://api.minimaxi.com/v1/chat/completions`
- 音乐生成使用 `MINIMAX_MUSIC_ENDPOINT`，缺省值为 `https://api.minimaxi.com/v1/music_generation`
- 歌词生成使用 `MINIMAX_LYRICS_ENDPOINT`，缺省值为 `https://api.minimaxi.com/v1/lyrics_generation`
- 音乐结果会由服务端抓取并持久化到平台历史，不直接依赖上游的 24 小时临时 URL

## Music Generation

- 入口位于主聊天侧边栏 `Music Generation`
- 单页内提供 `歌词工作台` 与 `音乐工作台` 两个标签
- 歌词工作台支持独立歌词生成与编辑/续写，并保存 `songTitle`、`styleTags` 与歌词历史
- 音乐工作台支持 `music-2.6`、`music-2.6-free`、`music-cover`、`music-cover-free`
- 作曲模型支持 `prompt`、`lyrics`、`isInstrumental`、`lyricsOptimizer`
- 翻唱模型支持本地参考音频上传；服务端会先把参考音频备份到 OSS，再同步等待 MiniMax 返回最终音频
- 页面生成中会锁定关键输入，并在刷新、关闭标签页或离开 `Music Generation` 页面时弹出二次确认
- 当前不提供参考音频下载入口，也未开放输出格式、采样率、码率配置 UI

## 许可证

本项目采用 GNU Affero General Public License v3.0（AGPL-3.0）许可证发布，详见 [LICENSE](./LICENSE) 文件。
