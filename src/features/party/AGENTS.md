# party feature 协作说明

本文件适用于 `src/features/party/` 目录及其子目录。

## 职责范围

- 群聊 / party chat 前端页面入口

## 修改原则

- 保持 feature 层轻量，优先作为路由和页面入口
- 如果涉及实时通信、共享状态或桌面/移动分层，先检查现有 `src/pages/party-chat/` 相关实现，再做增量调整
- 路径命名继续沿用 `/party`
