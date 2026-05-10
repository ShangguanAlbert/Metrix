# 群聊 `@AI` 固定 GPT-5.4 架构方案

## Summary

- 群聊 `@AI` 全局固定为 `packycode / gpt-5.4`，学生不可选择模型。
- 面向 `7-8` 个群并发使用场景，采用 `Web 服务 + Redis 队列 + 独立 AI worker` 架构。
- 产品侧不暴露全局配额；工程侧由 worker 池容量控制总执行数。
- 并发规则固定为：
  - 单房间同时运行上限：`4`
  - 单用户同时运行上限：`2`
  - 单用户等待上限：`3`
  - 单房间等待上限：`12`
- 已开始运行的任务不抢占、不取消，只排队。
- 群聊 `@AI` 接入实时链路后仍必须满足：
  - 空闲挂机时不能自己循环
  - 流式更新不能放大成无效广播和无效 state 写入
  - AI 状态变化不能污染房间活动时间和房间重订阅链路

## Architecture

### 1. 角色与职责

- Web 服务负责：
  - 接收群消息
  - 识别 `@AI`
  - 创建用户消息、AI 占位消息、任务记录
  - 将任务推入 Redis
  - 通过群聊 WebSocket 广播消息创建与更新事件
- Redis 负责：
  - 任务排队
  - 多 worker 抢任务协调
  - 房间/用户计数器
  - 原子配额判断
  - 去重键与短时锁
- 独立 AI worker 负责：
  - 从 Redis 取任务
  - 校验房间和用户并发规则
  - 调用固定 GPT-5.4 内核
  - 流式更新 AI 占位消息
  - 写回任务最终状态

### 2. 固定模型策略

- 群聊 `@AI` 不复用学生私聊 session 的 agent 选择。
- 不支持 `@AI-A`、`@AI-B` 或任何模型切换 UI。
- 所有群聊 AI 任务执行时固定覆盖为：
  - `agentId = "A"`
  - `provider = "packycode"`
  - `model = "gpt-5.4"`
  - `protocol = "chat"`
- 固定 GPT-5.4 的理由：
  - 当前仓库已有稳定的 `Agent A -> gpt-5.4` 运行时映射
  - 文件理解、图片理解和长上下文能力更适合群聊附件场景
  - 避免不同学生触发同一个群聊 AI 时行为漂移

### 3. 任务执行流

- 学生通过现有 `POST /api/group-chat/rooms/:roomId/messages/text` 发群消息。
- 服务端在消息落库后检测 `@AI`：
  - 若未命中，流程结束
  - 若命中，则冻结上下文快照，创建一条 AI 占位回复消息，并创建一条 `GroupChatAiTask(status=pending)`
- 任务写入 Mongo 后推入 Redis 队列。
- worker 抢到任务后：
  - 原子检查房间和用户并发槽位
  - 满足条件则转 `running`
  - 调用固定 GPT-5.4 流式生成
  - 持续将输出 patch 到占位消息
  - 完成后转 `done`
  - 超时或错误则转 `failed`
- 流式更新不新增多条消息，只更新同一条 AI 回复。
- 任务状态流转、流式 patch、失败回写都只能作用于目标 AI 消息本身，不能额外触发房间级可见副作用。

### 4. 为什么直接上 Redis Worker

- 当存在 `7-8` 个群同时用 `@AI` 时，单进程轮询 Mongo 会较快碰到调度、恢复和扩容瓶颈。
- Redis 更适合多实例下的：
  - 抢任务
  - 重试
  - 计数器
  - 去重
  - 延迟任务
- 这样 Web 服务与 AI 执行解耦，群聊入口不会被 GPT-5.4 长流式请求拖慢。

## Data Model

### 1. `GroupChatMessage`

- 新增字段：
  - `senderKind: user | system | ai`
  - `aiMeta.taskId`
  - `aiMeta.agentId`
  - `aiMeta.provider`
  - `aiMeta.model`
  - `aiMeta.requestedByUserId`
  - `aiMeta.triggerMessageId`
  - `aiMeta.status: pending | running | done | failed`
  - `aiMeta.streaming`
  - `aiMeta.error`
- AI 回复消息固定为：
  - `senderKind = "ai"`
  - `type = "text"`
  - `replyToMessageId = 触发消息 ID`
  - `aiMeta.model = "gpt-5.4"`

### 2. `GroupChatAiTask`

- 新建集合，字段包含：
  - `roomId`
  - `triggerMessageId`
  - `placeholderMessageId`
  - `requestedByUserId`
  - `requestedByUserName`
  - `agentId`
  - `provider`
  - `model`
  - `status`
  - `contextSnapshot`
  - `attachmentRefs`
  - `queueJobId`
  - `startedAt`
  - `finishedAt`
  - `lastError`
  - `attemptCount`
- 固定写入：
  - `agentId = "A"`
  - `provider = "packycode"`
  - `model = "gpt-5.4"`
- 索引要求：
  - `triggerMessageId` 唯一
  - `{ status: 1, createdAt: 1 }`
  - `{ roomId: 1, status: 1, createdAt: 1 }`
  - `{ requestedByUserId: 1, status: 1, createdAt: 1 }`

## Scheduling Rules

### 1. 房间与用户配额

- 单房间同时运行上限：`4`
- 单用户同时运行上限：`2`
- 单用户等待上限：`3`
- 单房间等待上限：`12`

### 2. 产品与工程边界

- 产品层不显示“全局最多允许多少并发”。
- 工程层仍由 worker 池配置决定系统总吞吐，不允许无限并发扩张。
- 不通过产品文案暴露 global cap，但 worker 进程数和每 worker 并发数必须可配置。

### 3. 不抢占策略

- 新任务不打断已经开始的 GPT-5.4 任务。
- 理由：
  - 抢占会浪费 token
  - 会留下半截回复
  - 会让消息状态机和前端复杂化
- 任务状态机固定为：
  - `pending`
  - `running`
  - `done`
  - `failed`

### 4. 连续 `@AI` 与多人并发

- 同一用户连续发多个 `@AI`：
  - 最多 `2` 个 `running`
  - 最多 `3` 个 `pending`
  - 超出的 AI 任务直接拒绝，但原始群消息仍正常发送
- 同一房间大量 `@AI`：
  - 最多 `4` 个 `running`
  - 最多 `12` 个 `pending`
- 多个房间并发：
  - 各房间独立受房间与用户配额约束
  - 由 worker 集群自然扩展处理能力

### 5. 去重与超时

- 相同用户在同一房间 `5-10` 秒内发送相同 `@AI` 内容，若已有 `pending/running`，直接提示“相同问题已在处理中”。
- 单任务硬超时：`75s`
- 超时后：
  - 任务标记 `failed`
  - AI 占位消息写入失败说明
  - 释放房间和用户槽位

## Context Strategy

- 每个任务在创建时冻结 `contextSnapshot`，而不是执行时再回看房间最新消息。
- 上下文默认包含：
  - 触发消息前的近期文本消息
  - 若触发消息回复了文件/图片消息，则优先带上该附件
  - 若没有显式回复附件，则补最近相关附件
- 不读取触发点之后的新消息，避免并发任务互相污染上下文。
- 附件处理复用现有群聊文件存储和聊天流式附件解析能力，不新造附件管线。

## Realtime Behavior

- 保留现有群聊 WebSocket 事件：
  - `message_created`
  - `message_deleted`
  - `room_updated`
- 新增：
  - `message_updated`
- AI 流式输出通过 `message_updated` 广播到房间。
- 广播节流为 `150-300ms` 一次，避免 token 级刷屏。
- 群聊 `@AI` 运行过程默认约束：
  - 占位消息从 `pending -> running -> done/failed` 的变化，只更新同一条消息
  - 不允许因为 AI 消息状态变化而广播 `room_updated`
  - 不允许因为 AI 流式 patch 而更新房间 `updatedAt`
  - 不允许因为同一内容重复 patch 而持续广播无变化 `message_updated`

## Realtime Guardrails

### 1. 这条链路默认按“空闲也会长时间挂着”设计

- 必须默认假设：
  - 群聊页面会空挂 `10-60` 分钟
  - 用户可能停留在房间里但不继续发消息
  - worker 会持续推送 `message_updated`
  - WebSocket 和前端房间状态同步会长期共存
- 所以群聊 `@AI` 不能只按“发完一条就结束”的短链路思维实现。

### 2. AI 流式更新必须幂等

- 同一条 AI 回复的重复 patch 输入，结果必须稳定。
- 如果 patch 后消息内容、状态、流式标记都没有变化，服务端不应继续广播。
- 如果前端收到的 `message_updated` 与当前消息等价，必须直接跳过 no-op state write。
- 重复的 `done`、`failed`、`running` 状态回写不能继续放大成前端重渲染热点。

### 3. AI 状态变化不能污染房间级状态

- `pending` 占位消息创建属于真实消息创建，可以正常触发一次 `message_created`。
- 之后的 `running`、流式 token patch、`done`、`failed` 都只允许更新该 AI 消息，不允许：
  - 更新房间 `updatedAt`
  - 触发 `room_updated`
  - 触发房间重排序
  - 触发房间重订阅
- 群聊房间列表中的“最新时间”必须继续只代表真实消息活动，而不是 AI 内部状态机变化。

### 4. 不允许形成新的实时闭环

- 需要明确规避以下链路：
  - `message_updated` -> 前端无条件 `setState` -> 房间列表变化 -> 重跑订阅同步
  - AI 状态更新 -> `room_updated` -> 房间重排 -> 前端反复重建 `rooms`
  - worker 高频 patch -> 前端无差别接收 -> 空闲挂机时持续高频 WS 和 React 更新
- 结论是：
  - `@AI` 的流式能力只能更新目标消息
  - 不能把消息级更新扩散成房间级更新
  - 不能把一次回答过程写成空闲自循环

## Frontend Requirements

- mention picker 增加保留项 `AI`，但它不是实际群成员。
- 不显示任何模型选择入口。
- AI 消息样式单独渲染，可显示固定标签 `AI · GPT-5.4`。
- AI 消息状态明确显示：
  - `AI 排队中`
  - `AI 正在回答`
  - `回答失败`
  - 正常完成内容
- 每条 AI 消息都挂在触发消息下面，复用 `replyToMessageId`。
- 不引入全局 streaming 锁，每条 AI 回复独立更新。
- 前端处理 `message_updated` 时必须先判断是否真有内容变化；无变化时直接跳过 state 更新。

## Test Plan

- 普通群消息不带 `@AI` 时，现有行为不变。
- 单个学生 `@AI`：
  - 用户消息先显示
  - AI 占位消息立即出现
  - 内容流式更新
  - 最终状态为 `done`
- 实时链路防线：
  - AI 流式 patch 不会触发房间 `updatedAt` 变化
  - AI 状态变化不会触发 `room_updated` 噪音广播
  - 空闲挂机时不会因为 `message_updated` 持续形成 WS 自循环
  - 同一内容的重复 patch 不会重复写前端 state
- 回复文件消息再 `@AI`：
  - AI 上下文包含该文件
  - 执行模型固定为 `gpt-5.4`
- 同一学生连续 5 次 `@AI`：
  - 最多 `2` 个 `running`
  - 最多 `3` 个 `pending`
  - 超出的 AI 任务被拒绝
- 同一房间高并发：
  - 最多 `4` 个 `running`
  - 最多 `12` 个 `pending`
- `7-8` 个房间同时 `@AI`：
  - 各房间独立排队与运行
  - worker 集群可横向扩展
- 学生无法通过任何方式切换群聊 AI 模型。
- worker 异常、超时、重启后：
  - 任务可恢复或明确失败
  - 不留下永久“正在回答”的僵尸占位消息

## Assumptions

- 第一版不做真正 thread 子会话，只用 `replyToMessageId` 承载关系。
- 第一版群聊 AI 全局固定为 `Agent A = packycode / gpt-5.4`。
- 第一版不支持学生切换模型。
- 第一版直接引入 Redis 和独立 worker，不使用单应用进程轮询 Mongo 的调度方式。
- 产品层不暴露全局并发配额提示；工程层仍由 worker 池容量决定系统总吞吐。
- 第一版不做中途取消和抢占。
- 第一版群聊 `@AI` 的工程底线还包括：
  - **消息级更新不能扩散成房间级副作用**
  - **空闲挂机时不能自己循环**
