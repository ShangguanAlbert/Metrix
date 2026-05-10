# 群聊 AI 后台 Notes 与主动参与架构方案

## Summary

- 目标：在现有群聊 `@AI` 基础上，为每个群维护后台 `notes`，并让 AI 在合适时机主动参与讨论。
- 群聊 AI 全局固定为 `packycode / gpt-5.4`，学生不可选择模型。
- 第一版不落真实 Markdown 文件，不给前台展示笔记；`notes` 仅作为后台长期上下文。
- 主动参与采用“受控陪练型”策略：
  - 群聊空闲一段时间后，低频发 1 条引导消息
  - 群聊讨论明显卡住时，低频发 1 条推进消息
- 主动参与链路 **不占用正常 `@AI` 的执行容量**：
  - 学生手动 `@AI` 使用主 worker 池
  - 后台 `notes` 刷新与主动发言使用独立 proactive worker 池
- 新增后台 notes 和主动参与后，实时链路仍必须满足：
  - 空闲挂机时不能自己循环
  - 重复事件不能放大副作用
  - 无变化时不能重复写 state 或重复广播

## Goals

- 让群聊 AI 不只在学生 `@AI` 时被动响应，而是能长期理解每个群在讨论什么。
- 让 AI 在不打扰正常学习的前提下，适度地主动把讨论拉回学习目标、文件内容或未解决问题。
- 保证学生手动 `@AI` 的稳定性和响应优先级，不被后台主动任务拖慢。

## Architecture

### 1. 基础分层

- Web 服务负责：
  - 接收群消息
  - 落库用户消息
  - 识别是否需要刷新房间 `notes`
  - 在满足条件时创建 AI 任务
  - 通过群聊 WebSocket 广播 AI 消息
- Redis 负责：
  - 防抖键
  - 延迟调度
  - 队列
  - 任务去重
  - worker 抢占协调
- Mongo 负责：
  - 持久化群聊消息
  - 持久化 `GroupChatAiTask`
  - 持久化 `GroupChatRoomNotes`
- AI workers 分为两类：
  - `group-chat-ai-worker`：只处理学生手动 `@AI`
  - `group-chat-ai-proactive-worker`：只处理 `notes_refresh` 和 `proactive_nudge`

### 2. 为什么要独立 proactive worker 池

- 主动参与本质上是后台增强能力，不应该影响学生显式触发的 `@AI`。
- 如果主动任务和 `@AI` 回复共用同一执行池，即使做了优先级，也仍可能在高峰时抢占 worker 槽位。
- 因此第一版直接固定为：
  - 共用 Redis
  - 共用 Mongo
  - 共用任务模型
  - 共用固定 GPT-5.4
  - **不共用执行容量**
- 结果是：
  - proactive worker 挂掉，不影响正常 `@AI`
  - proactive worker 堵塞，不影响正常 `@AI`
  - 调整主动参与频率时，不会误伤主链路

### 3. 任务类型

- `mention_reply`
  - 学生在群聊中显式 `@AI`
  - 沿用当前群聊 `@AI` 流式回复能力
- `notes_refresh`
  - 后台刷新房间长期笔记
  - 不向前台创建消息
  - 不触发任何无意义的群房间广播
- `proactive_nudge`
  - AI 主动发起一条普通群消息
  - 带 `AI 主动发起` 标记

### 4. 固定模型策略

- 三类任务统一固定为：
  - `agentId = "A"`
  - `provider = "packycode"`
  - `model = "gpt-5.4"`
  - `protocol = "chat"`
- 理由：
  - 现有仓库已稳定接入 `Agent A -> gpt-5.4`
  - 文件理解、图片理解、长上下文能力更适合群聊场景
  - 避免不同触发方式下群聊 AI 行为漂移

## Data Model

### 1. `GroupChatRoomNotes`

- 新建集合，`roomId` 唯一。
- 字段建议包含：
  - `roomId`
  - `provider`
  - `model`
  - `notes`
  - `recentTurns`
  - `summaryUpToMessageId`
  - `lastSourceMessageAt`
  - `lastRefreshedAt`
  - `lastProactiveAt`
  - `cooldownUntil`
  - `lastProactiveDecision`
- `notes` 结构采用后台结构化记忆，而不是单段长文本：
  - `roomTopic`
  - `currentFocus`
  - `facts`
  - `openQuestions`
  - `fileSummaries`
  - `participantSignals`
  - `doNotRepeat`

### 2. `GroupChatAiTask`

- 复用现有 `GroupChatAiTask`，新增：
  - `taskType`
  - `roomNotesVersion` 或 `roomNotesUpdatedAt`
  - `triggerReason`
- `taskType` 允许值：
  - `mention_reply`
  - `notes_refresh`
  - `proactive_nudge`

### 3. `GroupChatMessage.aiMeta`

- 扩展字段：
  - `taskType`
  - `initiative: passive | proactive`
  - `notesUpdatedAt`
- 主动消息固定为：
  - `senderKind = "ai"`
  - `initiative = "proactive"`
  - `taskType = "proactive_nudge"`

## Notes Strategy

### 1. 后台 notes 的定位

- `notes` 是群聊 AI 的长期结构化上下文，不是前台可见文档。
- 第一版不提供下载、查看、编辑入口。
- 如果后续需要人工查看，可在调试接口或管理工具里临时渲染为 Markdown 文本，但不作为正式存储格式。

### 2. 长期摘要 + 近期增量

- 不持续重扫整个群历史。
- 每次只处理 `summaryUpToMessageId` 之后的新消息，再和旧 `notes` 合并。
- 附件只保留：
  - 文件摘要
  - 关键结论
  - 需要追问的点
- 不保留：
  - 大段原文
  - 整页 PDF 文本
  - base64
  - 超长表格原始内容

### 3. 刷新触发方式

- 每次新的非 AI 群消息到达后，刷新房间的 Redis 防抖键。
- 默认防抖时间：`90s`
- 只要房间持续有新消息，就继续推迟 `notes_refresh`。
- 群聊安静一段时间后，再创建一次 `notes_refresh`。
- 第一版不做全量周期扫描所有房间，避免大量空转任务。
- 防抖调度必须幂等：
  - 同一房间在同一窗口内最多保留 1 个待执行 `notes_refresh`
  - 新消息只能覆盖到期时间，不能额外堆积重复任务
- `notes_refresh` 完成后不允许因为“notes 已刷新”就向前台广播 `room_updated`、`presence` 或其他可见事件。

## Proactive Participation

### 1. 触发场景

- 第一版同时支持两类触发：
  - 空闲后轻提醒
  - 讨论卡住时介入

### 2. 空闲后轻提醒

- 默认条件建议：
  - 最近一次人类消息后安静 `10min`
  - 自上次主动消息后至少新增 `4` 条人类消息
  - 最近 `2h` 内该群存在真实讨论
- AI 消息目标：
  - 轻总结这段讨论
  - 提 1 个下一步问题
  - 引导继续回到学习材料或题目

### 3. 讨论卡住时介入

- 默认条件建议：
  - 近 `12min` 内至少 `6` 条文本消息
  - 至少 `2` 个不同学生参与
  - 当前没有新的 `@AI`
  - `notes` 或近期消息判断为：
    - 问题未解
    - 观点反复
    - 讨论缺少推进
- AI 消息目标：
  - 点明未解决点
  - 给一个更具体的问题切口
  - 把讨论拉回文件、图片或课程任务

### 4. 内容边界

- 第一版主动消息只允许：
  - 轻总结 + 下一问
  - 未解决点提醒
  - 依据文件内容的推进式提问
- 第一版禁止：
  - 连续主动刷屏
  - 连续追问用户
  - 离开课程主题自由发散
  - 和自己前一次主动消息重复表述

### 5. 消息形态

- 主动消息作为普通群消息插入消息流。
- 不挂在某条学生消息下。
- 前端显示标签：
  - `AI 主动发起 · GPT-5.4`

## Queueing and Isolation

### 1. 主链路与主动链路隔离

- 学生手动 `@AI`：
  - 队列：主 `mention_reply` 队列
  - worker：`group-chat-ai-worker`
  - 容量：沿用当前主 worker 并发配置
- 后台 `notes_refresh` / `proactive_nudge`：
  - 队列：独立 proactive 队列
  - worker：`group-chat-ai-proactive-worker`
  - 容量：独立 proactive 并发配置

### 2. 隔离原则

- proactive worker **不占用** 主 `@AI` worker 槽位。
- proactive worker 的 Redis 队列与消费循环独立。
- 即使主动任务堆积，也不能延迟学生 `@AI`。
- 主动任务仍可复用相同的：
  - Redis 连接
  - Mongo 连接
  - 任务表
  - GPT-5.4 运行时

### 3. 主动任务频控

- 同一房间任意时刻最多 `1` 个 `proactive_nudge` 处于 `pending/running`。
- 同一房间 `30min` 内最多发送 `1` 条主动消息。
- 只要同房间存在 `mention_reply` 的 `pending/running`，禁止创建新的 `proactive_nudge`。
- `notes_refresh` 可以继续排队，但优先级低于学生手动 `@AI`。

## Realtime Guardrails

### 1. 这条链路默认按“空闲也会长时间挂着”设计

- 不能把后台 notes 当成一次性任务链路来写。
- 必须默认假设：
  - 群聊页面会空挂 `10-60` 分钟
  - 用户会切换房间但不刷新页面
  - WebSocket 与 worker 推送会长期共存
  - `message_updated`、`presence`、房间同步会并行出现

### 2. 所有后台调度默认幂等

- 同一房间重复收到“需要刷新 notes”的信号时，结果必须稳定。
- 同一个 `notes_refresh` 完成后，不允许再反向触发新的同类任务形成闭环。
- 同一条主动消息判定结果，如果输入上下文没有变化，不能重复建任务。
- 同一房间的冷却状态、去重键和判定锁必须能阻断重复触发。

### 3. Notes 刷新不能变成实时广播热点

- `notes_refresh` 只写 `GroupChatRoomNotes`，不改群消息流，不更新房间活动时间，不写已读状态。
- 禁止把“后台 notes 更新时间”映射成前台房间 `updatedAt`。
- 禁止因为后台 notes 更新而触发房间重排序、房间重订阅或 presence 重算。
- 只有真正创建 `proactive_nudge` 消息时，才允许走一次正常的 `message_created` 广播。

### 4. 前端消费主动消息也要避免 no-op 更新

- 新增 `initiative = "proactive"` 只是一种消息类型，不能引入新的全量房间重刷逻辑。
- 若同一条主动消息的补丁内容没有变化，前端必须跳过 no-op state write。
- 禁止收到主动消息后无条件重跑全部房间订阅同步。
- 禁止把“后台任务状态变化”直接透传成高频前端 state 变化。

### 5. 不允许出现新的自循环闭环

- 需要明确规避以下链路：
  - 新消息 -> 防抖任务 -> notes_refresh -> room_updated -> 前端重订阅 -> 新一轮后台信号
  - 主动消息 -> 再次触发主动判定 -> 连续主动消息
  - notes 刷新 -> 房间时间变化 -> 前端重排/重订阅 -> 再次产生后台任务
- 结论是：
  - `notes_refresh` 是纯后台维护
  - `proactive_nudge` 是低频、单次、可冷却的可见输出
  - 两者都不能把群聊实时链路变成空闲自循环

## Backend Flow

### 1. 新消息进入后的流程

1. 用户发送群消息。
2. 服务端正常落库并广播。
3. 若是学生显式 `@AI`：
   - 继续创建 `mention_reply` 任务
   - 推入主 `@AI` 队列
4. 若是普通人类消息：
   - 更新房间 notes 防抖键
   - 到达防抖时机后创建 `notes_refresh`
   - 该过程不得回写房间可见状态，不得触发额外前端重订阅

### 2. `notes_refresh` 流程

1. proactive worker 拉取 `notes_refresh`。
2. 读取 `summaryUpToMessageId` 之后的新消息。
3. 结合旧 `notes` 生成新的结构化群聊笔记。
4. 写回 `GroupChatRoomNotes`。
5. 如果新的 `notes` 与当前内容等价，直接结束，不再广播、不再派生主动任务。
6. 调用主动参与判定器：
   - 不满足则结束
   - 满足则创建 `proactive_nudge`

### 3. `proactive_nudge` 流程

1. proactive worker 拉取 `proactive_nudge`。
2. 再次检查：
   - 冷却时间
   - 是否有主 `@AI` 任务正在跑
   - 是否已存在房间主动消息任务
3. 满足条件才生成文本。
4. 生成一条普通 AI 群消息并广播。
5. 更新 `lastProactiveAt` 与决策记录。
6. 主动消息发出后必须进入冷却，禁止基于自己刚发出的消息再次立即触发主动判定。

## Frontend Impact

- 现有群聊消息流基本不变。
- 仅需补充：
  - 识别 `initiative = "proactive"`
  - 渲染 `AI 主动发起 · GPT-5.4`
  - 与普通 `@AI` 回复做轻度样式区分
  - 对主动消息的重复 patch 跳过 no-op state write
- 第一版不做：
  - 群笔记查看面板
  - 主动参与开关 UI
  - 主动参与频率配置 UI

## Deployment and Runtime

- 在现有 `docker-compose` 基础上增加一个 proactive worker 服务。
- 本地开发继续保持：
  - Mongo 单独起
  - Redis 单独起
  - `npm run dev` 启动 Web + 主 `@AI` worker + proactive worker
- 服务端部署保持：
  - `docker compose up -d --build`
- 新增的环境变量或服务端常量至少包括：
  - `GROUP_CHAT_PROACTIVE_ENABLED`
  - `GROUP_CHAT_NOTES_DEBOUNCE_MS`
  - `GROUP_CHAT_PROACTIVE_IDLE_MS`
  - `GROUP_CHAT_PROACTIVE_STUCK_WINDOW_MS`
  - `GROUP_CHAT_PROACTIVE_COOLDOWN_MS`
  - `GROUP_CHAT_PROACTIVE_WORKER_CONCURRENCY`

## Test Plan

- 普通群消息不带 `@AI` 时，现有行为不变。
- 学生手动 `@AI`：
  - 继续由主 worker 处理
  - 不依赖 proactive worker
- `notes_refresh`：
  - 连续消息只触发一次防抖刷新
  - 只总结增量消息
  - 文件内容只进入摘要，不进入原文堆积
  - notes 内容等价时不派生额外广播和主动任务
- `proactive_nudge`：
  - 空闲达到阈值时可触发
  - 卡住达到阈值时可触发
  - `30min` 冷却内不会再次触发
- 实时链路防线：
  - 后台 notes 更新不会触发房间 `updatedAt` 变化
  - 后台 notes 更新不会触发 `room_updated` 噪音广播
  - 空闲挂机时不会因为主动参与链路持续产生 WebSocket 往返帧
  - 主动消息和消息补丁在无变化时不会重复写前端 state
- 容量隔离：
  - 主动 worker 堵塞时，学生手动 `@AI` 仍能正常运行
  - 学生手动 `@AI` 高并发时，主动 worker 不会占用主链路槽位
- 恢复与幂等：
  - worker 重启后不重复发送同一条主动消息
  - proactive worker 异常不会影响正常 `@AI`

## Assumptions

- 第一版群聊 AI 仍固定为 `Agent A = packycode / gpt-5.4`。
- 第一版不做真实 Markdown 文件，不做前台群笔记展示。
- 第一版全局默认开启主动参与，但仅通过服务端配置控制。
- 第一版主动消息定位为“受控陪练”，不是持续在线助教。
- 第一版最重要的工程原则是：
  - **主动参与增强体验**
  - **不能影响正常 `@AI` 主链路**
  - **不能把群聊实时链路重新写成空闲自循环**
