# 群聊实时链路内存回归防线

## 适用范围

- 适用于 `/party` 群聊页，尤其是群内 `@AI`、群聊 WebSocket、房间在线状态、消息流式更新这几条链路。
- 目标不是“内存绝对不涨”，而是避免页面在空闲状态下因为无效订阅、无效状态写入或重复广播而持续放大内存与 CPU 占用。

## 这次问题的根因

本次内存持续升高，不是右侧 `@AI` 面板，也不是图片本身，而是群聊实时链路形成了闭环：

1. 前端房间状态 `rooms` 变化后，会重新对全部房间执行 `join_room`。
2. 服务端收到 `join_room` 后，即使该 socket 已经加入过该房间，仍然继续回 `joined` 和 `member_presence_updated`。
3. 前端收到 `member_presence_updated` 后，即使在线成员列表没有变化，也仍然执行 `setRooms(...)`。
4. `rooms` 再次变化后，又触发下一轮房间重订阅。

这个闭环会导致：

- 空闲挂机时 WebSocket 仍持续有往返帧。
- React 状态持续被重建。
- Chrome tab 内存、CPU、发热一起升高。

## 本次修复做了什么

### 1. 房间订阅必须幂等

- 文件：[src/pages/party/partySocket.js](/Users/fuze/Documents/GitHub/Metrix/src/pages/party/partySocket.js)
- 规则：同一个房间如果已经在 `desiredRooms` 中，前端不得再次发送 `join_room`。

这条规则保证“同一连接内，对同一房间的重复订阅请求”不会继续放大。

### 2. 房间订阅同步必须先做 diff

- 文件：[src/pages/party-chat/desktop/PartyChatDesktopPage.jsx](/Users/fuze/Documents/GitHub/Metrix/src/pages/party-chat/desktop/PartyChatDesktopPage.jsx)
- 辅助模块：[src/pages/party/partyRealtimeState.js](/Users/fuze/Documents/GitHub/Metrix/src/pages/party/partyRealtimeState.js)
- 规则：`rooms` 变化时，只允许：
  - 对新增房间发送 `join_room`
  - 对已移除房间发送 `leave_room`
- 禁止每次 `rooms` 改动后把当前所有房间重新订阅一遍。

### 3. presence 更新必须跳过 no-op state write

- 文件：[src/pages/party-chat/desktop/PartyChatDesktopPage.jsx](/Users/fuze/Documents/GitHub/Metrix/src/pages/party-chat/desktop/PartyChatDesktopPage.jsx)
- 规则：收到 `member_presence_updated` 后，必须先比较在线成员列表是否真的变化。
- 如果 `onlineMemberUserIds` 与当前值一致，必须直接返回旧 state，不能继续 `setRooms(...)`。

### 4. 在线成员列表必须先规范化

- 文件：[src/pages/party/partyRealtimeState.js](/Users/fuze/Documents/GitHub/Metrix/src/pages/party/partyRealtimeState.js)
- 规则：
  - 只保留当前房间成员中的用户 ID
  - 去重
  - 去掉空值
  - 用统一顺序做比较

否则很容易出现“内容等价但数组不同”的假变化，继续触发无效渲染。

### 5. 纯逻辑要拆出来做定向测试

- 测试文件：
  - [tests/chat/party-socket-client.test.js](/Users/fuze/Documents/GitHub/Metrix/tests/chat/party-socket-client.test.js)
  - [tests/chat/party-realtime-state.test.js](/Users/fuze/Documents/GitHub/Metrix/tests/chat/party-realtime-state.test.js)

以后只要改动以下行为，必须先补或改对应测试：

- `join_room` 是否重复发出
- 房间订阅 diff 是否正确
- `presence` 列表规范化是否正确
- 相同列表是否被错误地判断为变化

## 以后改这块代码必须遵守的原则

### 原则 1：实时链路上的所有操作默认按“幂等”设计

- 重复调用不能产生额外副作用。
- 同一条消息、同一个房间、同一个在线状态，重复输入时结果必须稳定。
- 如果某个实时 API 不是幂等的，必须在注释或文档里明确写出来，并解释为什么无法做成幂等。

### 原则 2：任何 `setState` 之前先判断是不是 no-op

- 尤其是 `rooms`、`messagesByRoom`、`onlineMemberUserIds` 这种高频状态。
- 如果新值与旧值等价，就直接返回旧 state。
- 不允许为了“代码省事”无条件生成新数组、新对象。

### 原则 3：不要把“状态对象变化”当成“业务变化”

- `rooms` 数组重新创建，不代表房间集合真的变化。
- 只有“房间 ID 集合变了”才允许触发订阅变化。
- 只有“房间成员在线列表变了”才允许触发 presence 状态更新。

### 原则 4：WebSocket 事件与页面 state 之间必须有去抖层

- 不要求一定做时间维度 debounce。
- 但至少要做“语义去重”：
  - 重复订阅不再发包
  - 内容不变不再写 state
  - 房间集不变不再重跑订阅同步

### 原则 5：群内 `@AI` 新功能默认按“空闲也会长期挂着”来设计

- 不能只按“发一条消息就刷新一下”的短时链路思路写代码。
- 必须假设：
  - 页面会挂 10 到 60 分钟
  - 用户可能切换房间但不刷新页面
  - worker 可能持续回推 `message_updated`
  - fallback polling 与 WebSocket 会并存

所以任何新增逻辑都要先问一句：空闲挂着时，它会不会自己循环。

## 后续开发检查清单

改动群聊 `@AI`、群聊实时链路、WebSocket、presence、消息更新时，提交前至少检查以下项目：

1. 是否存在“收到事件后无条件 `setState`”。
2. 是否存在“依赖数组/对象引用变化”来触发订阅、广播或同步。
3. 是否存在“对同一房间重复发送 `join_room`”。
4. 是否存在“服务端对重复 join 继续回全量 presence”的路径。
5. 是否存在“空闲状态下仍持续产生 WS 帧”的可能。
6. 是否补了最小必要的定向测试。

## 推荐调试方法

如果后面再次出现“群聊页面空挂着内存一直涨”，优先按这个顺序查：

1. Chrome DevTools 的 `Socket` 面板，确认空闲时是否仍持续有 `group-chat` 帧往返。
2. 前端检查 `rooms`、`onlineMemberUserIds`、`messagesByRoom` 是否被频繁重建。
3. 检查 `join_room -> member_presence_updated -> setRooms -> join_room` 是否重新出现闭环。
4. 再看群内 `@AI` 的 `message_updated` 是否存在长时间不收敛的流式 patch。
5. 最后才看图片、附件、轮询兜底等次级放大因素。

## 结论

以后这块代码的底线不是“功能能跑就行”，而是：

- 空闲挂着不能自己循环
- 重复事件不能放大副作用
- 高频 state 不能无效重建
- 实时订阅必须可证明地幂等

只要违反上面任一条，就有很大概率再次写出内存持续升高的代码。
