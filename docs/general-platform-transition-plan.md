# EduChat 通用平台改造计划

## 背景

当前 EduChat 更接近实验专用平台：账号、课堂、教师作用域、资源下载、AI 生成额度和部署方式都带有明显的实验环境假设。要改成通用软件平台，需要先把安全边界和数据边界补齐，再把课堂能力从特定实验场景中拆出来，变成可配置的工作区能力。

本计划面向内网智算中心部署环境，默认存在这些约束：

- 服务器可能无法连接外部 Git 仓库。
- 服务器可能无法访问公网镜像仓库。
- 发布包需要通过堡垒机、SFTP、内网网盘、管理平台上传或其他离线方式进入内网。
- 生产密钥、数据库、Redis、对象存储和 AI provider 配置留在服务器或中心安全系统内。
- 本地开发环境和生产运行环境分开管理。

## 目标

- 支持多个租户、多个工作区、多个角色和多类业务资源。
- 用户、聊天、笔记、文件、图片、音乐、课堂、群聊数据按租户和工作区隔离。
- 登录、找回密码、管理员操作、文件下载、文档预览、AI 生成和 WebSocket 都具备明确安全控制。
- 生产发布采用版本化离线发布包，可回滚、可审计、可迁移。
- 课堂能力保留，但从固定实验课堂改为通用工作区模块。

## 非目标

- 第一阶段不引入大规模微服务拆分。
- 第一阶段不强制引入 Kubernetes。
- 第一阶段不依赖公网 GitHub、Docker Hub 或外部 CI/CD。
- 第一阶段不重写全部前端页面。
- 第一阶段不改变 React、Vite、Express、MongoDB 的主体技术栈。

## 当前主要问题

### 安全问题

- 找回密码接口存在无凭证重置风险。
- 用户密码存在明文字段和导出路径。
- 认证密钥存在固定默认值和示例值误用风险。
- 文档预览存在服务端请求伪造风险。
- 附件下载可以凭客户端传入的 `ossKey` 生成签名链接。
- 笔记图片读取接口缺少登录和所有者校验。
- Markdown 渲染允许原始 HTML，放大同源 XSS 风险。
- AI 生成、图片生成、音乐生成缺少统一限流、配额和并发控制。
- SSE 断开后缺少上游请求取消。
- WebSocket 缺少连接数和订阅数上限。
- 启动日志可能输出完整数据库连接串。

### 平台化问题

- `teacherScopeKey` 同时承担教师、课堂、业务边界和配置开关等职责。
- 部分课堂逻辑和特定教师作用域强绑定。
- 用户和资源缺少统一的 `tenantId`、`workspaceId`、`membership` 边界。
- 文件资源分散在聊天附件、群聊文件、课堂文件、笔记图片、图片历史、音乐历史等多个路径。
- 管理员角色缺少平台级、租户级、工作区级的分层。
- 发布流程偏实验环境，缺少离线版本包、健康检查、数据库迁移和回滚规范。

## 总体路线

改造分为 7 个阶段：

1. 安全封顶。
2. 租户、工作区和成员模型。
3. 用户、组织、课堂通用化。
4. 文件、笔记、聊天数据隔离。
5. AI 资源限流、配额和防滥用。
6. 管理后台和运维能力。
7. 内网离线发布、迁移、测试和上线验证。

前三个阶段是地基，建议优先完成。后续业务能力可以在地基稳定后逐步迁移。

## 阶段 1：安全封顶

目标：先关闭会被通用平台放大的高风险入口。

### 1.1 修复密码恢复

涉及位置：

- `server/routes/auth-user-classroom.js`

改造要求：

- 删除仅凭 `username/newPassword/confirmPassword` 完成重置的流程。
- 找回密码必须使用一次性短期 token、可信验证码、管理员批准或旧密码验证。
- `forgot/verify` 返回统一响应，避免账号枚举。
- 登录、注册、找回密码按 IP、用户名、设备标识做限流。
- 密码重置产生审计日志。

验收标准：

- 未登录用户无法直接改掉任意普通账号密码。
- 对不存在账号和存在账号的找回响应无明显差异。
- 连续失败请求会被限制。

### 1.2 移除明文密码

涉及位置：

- `server/services/core-runtime.js`
- `server/routes/auth-user-classroom.js`
- `server/routes/admin.js`

改造要求：

- `passwordPlain` 改为废弃字段。
- 新建、注册、重置密码时只保存哈希。
- 管理员用户列表和导出文件不返回密码。
- 编写迁移脚本清空历史 `passwordPlain`。
- 对曾经暴露过的账号执行强制重置策略。

验收标准：

- 数据库新写入用户没有明文密码。
- 管理员接口响应不包含用户密码。
- 导出文件不包含用户密码。

### 1.3 强制生产认证密钥

涉及位置：

- `server/services/core-runtime.js`
- `.env.example`
- `README.md`

改造要求：

- 生产环境缺少 `AUTH_SECRET` 时启动失败。
- `AUTH_SECRET` 等于示例值、默认值或长度过短时启动失败。
- `.env.example` 只保留占位符。
- 文档明确要求使用随机高熵密钥。
- 为后续密钥轮换预留 `tokenVersion` 或 `kid` 字段。

验收标准：

- 生产环境使用默认密钥无法启动。
- 日志明确提示缺少安全密钥，但不打印密钥内容。

### 1.4 修复文档预览 SSRF

涉及位置：

- `server/routes/chat-and-images.js`

改造要求：

- 删除 query `url` 直通预览能力。
- 预览只能从当前用户拥有的附件记录解析文件。
- 如必须保留远程拉取，只允许自家对象存储域名。
- 拦截 localhost、私网 IP、链路本地地址、云元数据地址。
- 跟随重定向后重新校验目标地址。
- 对响应增加超时、最大字节数、Content-Type 白名单和流式取消。

验收标准：

- 请求 `127.0.0.1`、`localhost`、`169.254.169.254`、内网网段均被拒绝。
- 用户无法预览不属于自己的附件。

### 1.5 修复附件下载授权

涉及位置：

- `server/routes/auth-user-classroom.js`
- `server/services/core-runtime.js`
- `src/features/chat/api/chatApi.js`

改造要求：

- 下载接口不接受客户端传入的裸 `ossKey` 作为授权依据。
- 客户端只传业务对象 ID，例如 `fileId`、`messageId`、`attachmentIndex`。
- 服务端按当前用户、会话、消息和附件索引查出文件记录。
- 文件签名 URL 必须在对象归属校验后生成。

验收标准：

- 已登录用户拿到他人 `ossKey` 后也无法生成下载链接。
- 群聊、课堂、图片、音乐和笔记文件分别走对应归属校验。

### 1.6 修复笔记图片鉴权

涉及位置：

- `server/routes/notes.js`
- `server/services/notes/note-image-model.js`

改造要求：

- `GET /api/notes/images/:imageId` 增加 `requireChatAuth`。
- 查询条件改为 `{ _id: imageId, userId: req.authUser._id }`。
- 需要分享时使用短期签名 URL 或显式分享 token。

验收标准：

- 未登录访问笔记图片返回 401。
- A 用户无法读取 B 用户笔记图片。

### 1.7 限制 Markdown 原始 HTML

涉及位置：

- `src/components/MessageList.jsx`
- `src/modules/notes/components/NoteEditor.jsx`
- `src/components/chat/ChatDocumentPreview.jsx`

改造要求：

- 默认移除 `rehypeRaw`。
- 如业务需要有限 HTML，使用 `rehype-sanitize` 严格白名单。
- 禁止 `iframe`、`script`、`object`、`embed`、事件属性、`srcdoc`、危险 URL scheme。
- 文档预览中的 Markdown 使用同一安全策略。

验收标准：

- 恶意 Markdown 无法执行同源脚本。
- 管理端打开用户内容时无法读取 token。

## 阶段 2：租户、工作区和成员模型

目标：用通用数据模型替换实验平台中的固定教师作用域。

### 2.1 新增核心概念

建议新增模型：

- `Tenant`：租户，例如学校、机构、团队。
- `Workspace`：租户下的工作区，可对应班级、项目组、课程空间。
- `Membership`：用户和工作区关系，包含角色、状态、加入时间。
- `Role`：角色定义，区分平台级、租户级、工作区级。
- `Permission`：权限点，例如 `chat:read`、`file:download`、`classroom:manage`。
- `FeatureFlag`：工作区启用能力，例如聊天、笔记、课堂、图片生成、音乐生成。

建议 token 只存放最小身份上下文：

```json
{
  "uid": "user id",
  "tid": "tenant id",
  "wid": "workspace id",
  "role": "student",
  "scope": "chat",
  "ver": 2
}
```

注意：敏感接口仍要查数据库确认 membership，不能只信 token。

### 2.2 替换 `teacherScopeKey`

当前 `teacherScopeKey` 的职责拆成：

- `tenantId`：租户边界。
- `workspaceId`：工作区边界。
- `membership.role`：用户在工作区内的角色。
- `workspace.features`：该工作区启用的功能。
- `classroom.teacherUserId` 或 `classroom.ownerUserId`：课堂管理归属。

改造要求：

- 登录时不接受普通用户自由选择教师作用域。
- 当前工作区由服务端 membership 派生。
- 切换工作区必须校验当前用户是否属于目标工作区。
- 所有课堂接口从 `teacherScopeKey` 判断迁移到 `workspaceId + permission` 判断。

验收标准：

- 未绑定用户无法进入任意课堂。
- 用户只能切换到自己拥有 membership 的工作区。
- 工作区关闭课堂功能时，课堂 API 返回 403 或功能未启用错误。

## 阶段 3：用户、组织、课堂通用化

目标：把实验账号和特定课堂能力改成可运营配置。

### 3.1 注册和登录模式

支持多种注册策略：

- 关闭公开注册。
- 邀请码注册。
- 管理员创建用户。
- 邮箱或手机号验证码注册。
- 内网统一身份认证或 OIDC 登录。

每个租户可以选择自己的注册策略。

### 3.2 角色分层

建议角色层级：

- 平台超级管理员：管理全平台租户和系统配置。
- 租户管理员：管理本租户用户、工作区、配额和 provider。
- 工作区管理员：管理某个工作区成员和功能。
- 教师或助教：管理课堂、任务、作业。
- 普通用户或学生：使用聊天、笔记、群聊、课堂学习功能。

### 3.3 课堂模块化

课堂相关数据建议拆成：

- `Classroom`
- `Lesson`
- `Assignment`
- `Submission`
- `ClassroomFile`
- `Roster`

课堂成为 `Workspace` 的一个功能模块。工作区启用课堂能力后才开放相关路由和页面。

验收标准：

- 新建工作区时可以选择是否启用课堂功能。
- 特定教师或特定课堂名称不再写死在代码分支里。
- 用户是否能访问课堂资源由 membership 和 roster 决定。

## 阶段 4：文件、笔记、聊天数据隔离

目标：所有用户上传和生成资源都通过统一文件对象授权。

### 4.1 统一文件模型

建议新增：

```js
FileObject {
  _id,
  tenantId,
  workspaceId,
  ownerUserId,
  resourceType,
  resourceId,
  ossKey,
  mimeType,
  size,
  checksum,
  visibility,
  createdAt,
  deletedAt
}
```

覆盖资源：

- 聊天附件。
- 群聊文件。
- 课堂附件。
- 作业提交文件。
- 笔记图片。
- 图片生成历史。
- 音乐生成历史。
- 文档预览缓存。

### 4.2 下载流程

统一下载流程：

1. 客户端传 `fileId`。
2. 服务端查 `FileObject`。
3. 服务端校验当前用户对 `tenantId/workspaceId/resourceId` 有访问权。
4. 服务端生成短期签名 URL 或流式返回。
5. 记录下载审计日志。

### 4.3 静态目录治理

要求：

- 停止发布整个 `uploads` 目录。
- 只发布明确公开的 `public-assets` 目录。
- 私有上传统一走鉴权下载接口。
- 历史 `/uploads/notes` 文件迁移到 `FileObject` 或删除。

验收标准：

- 裸路径无法读取私有上传文件。
- 任意资源下载都有审计记录。
- 对象存储 key 不再作为客户端授权凭据。

## 阶段 5：AI 资源限流、配额和防滥用

目标：保护智算中心资源、provider 费用和服务稳定性。

### 5.1 统一资源预算

覆盖入口：

- `/api/chat/stream`
- `/api/images/seedream/stream`
- `/api/music/generate`
- 群聊 `@AI`
- 文档预览
- 上传接口
- WebSocket

建议增加：

- 每用户并发上限。
- 每 IP 请求速率。
- 每租户每日额度。
- 每工作区并发上限。
- provider 全局并发池。
- 按模型、图片数、音乐任务、上传大小计费或扣额度。
- 超额返回 429。
- 资源拒绝、超时、取消写入审计日志。

### 5.2 SSE 和 provider 取消

要求：

- 所有 provider `fetch` 使用 `AbortController`。
- 客户端断开时取消上游请求。
- SSE reader 检查连接状态并及时停止。
- worker 超时时取消底层 LLM 请求。

### 5.3 WebSocket 防护

要求：

- upgrade 前按 IP 限制连接数和速率。
- 鉴权后按用户限制连接数。
- 按工作区或房间限制订阅数。
- 对慢 socket 做背压和快速关闭。

### 5.4 群聊 AI 队列恢复

要求：

- Redis pending/running key 设置 TTL。
- worker recovery 按 Mongo 任务重建 Redis 计数。
- 任务创建、容量校验和入队具备可重放能力。

验收标准：

- 超额 AI 请求返回 429。
- SSE 断开会中止上游 provider 调用。
- WebSocket 洪泛不能拖垮服务。
- Redis 崩溃或服务重启后队列容量能恢复。

## 阶段 6：管理后台和运维能力

目标：通用平台具备可运营、可审计、可排障能力。

### 6.1 管理后台

需要补齐：

- 租户管理。
- 工作区管理。
- 用户管理。
- 成员和角色管理。
- 邀请码和注册策略。
- 功能开关。
- AI 配额管理。
- provider 配置管理。
- 文件审计。
- 登录审计。
- 密码重置审计。
- 管理员操作审计。
- 安全事件面板。
- 资源使用报表。

### 6.2 运维安全

要求：

- 日志脱敏，覆盖 token、密码、Mongo URI、OSS key、Authorization header。
- 生产错误响应不返回内部错误 message。
- 健康检查区分 app、Mongo、Redis、OSS、provider。
- `.env.example` 只放占位符。
- Docker 默认密码强制覆盖。
- 启动前配置校验。

验收标准：

- 管理员可查看关键安全审计。
- 日志里不出现密钥和完整连接串。
- 健康检查能区分依赖故障。

## 阶段 7：内网离线发布、迁移和上线

目标：在无法连接 Git 仓库的智算中心内网中，建立可追踪、可回滚的发布流程。

### 7.1 发布包格式

每次发布生成一个版本化目录：

```text
educhat-release-20260613-001/
  educhat-20260613-001.tar
  docker-compose.prod.yml
  migrations/
    001-add-tenant-workspace.js
    002-backfill-memberships.js
  scripts/
    deploy.sh
    rollback.sh
    backup-mongo.sh
    healthcheck.sh
  VERSION.txt
  SHA256SUMS.txt
  README-deploy.md
```

发布包只包含程序镜像、部署描述、迁移脚本和说明文件。

发布包不包含：

- `.env.production`
- 生产数据库数据。
- 生产 OSS 密钥。
- AI provider 密钥。
- Mongo/Redis 密码。
- 本地调试缓存。
- `node_modules`
- 本地 `uploads`

### 7.2 本地构建发布包

示例流程：

```bash
docker build -t educhat:20260613-001 .
docker save educhat:20260613-001 -o educhat-20260613-001.tar
tar -czf educhat-release-20260613-001.tar.gz educhat-release-20260613-001/
```

Windows 环境可以使用 zip 包，核心要求是文件名带版本号。

### 7.3 智算中心服务器目录

建议服务器固定目录：

```text
/opt/educhat/
  docker-compose.yml
  .env.production
  current-version.txt
  previous-version.txt
  releases/
  backups/
  logs/
```

`.env.production` 只留在服务器，不进入发布包。

### 7.4 服务器部署流程

标准流程：

1. 上传 release 包。
2. 校验 `SHA256SUMS.txt`。
3. `docker load` 加载镜像。
4. 备份 MongoDB。
5. 执行迁移脚本。
6. 更新 `docker-compose.yml` 的镜像 tag。
7. `docker compose up -d` 启动新版本。
8. 执行健康检查。
9. 记录当前版本和上一版本。
10. 失败时执行回滚脚本。

### 7.5 回滚策略

要求：

- 每次发布保留上一版镜像。
- `current-version.txt` 记录当前版本。
- `previous-version.txt` 记录上一版。
- 回滚脚本将 compose 中 image tag 切回上一版。
- 数据库迁移要区分可逆和不可逆。
- 不可逆迁移上线前必须备份，并写清恢复方式。

### 7.6 数据库迁移策略

通用平台改造涉及字段：

- `tenantId`
- `workspaceId`
- `membership`
- `fileId`
- `ownerUserId`
- `resourceType`
- `resourceId`

迁移顺序建议：

1. 创建默认 `Tenant`。
2. 创建默认 `Workspace`。
3. 为现有用户创建 `Membership`。
4. 为聊天、笔记、图片、音乐、群聊、课堂数据补齐 `tenantId/workspaceId`。
5. 迁移旧附件和笔记图片到 `FileObject`。
6. 清空 `passwordPlain`。
7. 标记旧 token 失效，要求用户重新登录。

验收标准：

- 迁移前自动备份。
- 迁移脚本可重复执行，重复执行不会制造重复数据。
- 迁移后旧数据仍可访问，但必须经过新权限模型。

## 测试计划

### 安全测试

- 未登录用户无法重置他人密码。
- 普通用户无法读取其他用户笔记图片。
- 普通用户无法凭他人 `ossKey` 生成下载链接。
- 文档预览无法访问内网地址。
- Markdown 恶意 HTML 不执行。
- 生产默认密钥无法启动。
- 日志中不出现完整 Mongo URI、token、密码、OSS key。

### 租户和权限测试

- 用户只能进入自己所属工作区。
- 工作区 A 用户无法读取工作区 B 的资源。
- 租户管理员无法管理其他租户。
- 工作区管理员无法越权到平台级配置。
- 课堂资源访问必须满足 membership 和 roster 条件。

### 资源和防滥用测试

- AI 请求超过用户额度返回 429。
- 图片生成超过图片数或配额被拒绝。
- 音乐生成并发超限被拒绝。
- SSE 断开后 provider 请求被取消。
- WebSocket 超过连接数被拒绝。
- 群聊 AI Redis 计数在服务重启后能恢复。

### 离线发布测试

- 发布包校验失败时拒绝部署。
- 镜像加载后能启动。
- 健康检查失败时自动回滚。
- 数据库迁移失败时停止发布。
- 上一版镜像可快速恢复。

## 推荐执行顺序

### 第一批：必须先做

1. 修复找回密码。
2. 移除明文密码。
3. 强制生产认证密钥。
4. 修复文档预览 SSRF。
5. 修复附件下载授权。
6. 修复笔记图片鉴权。
7. 限制 Markdown 原始 HTML。

### 第二批：平台地基

1. 新增 `Tenant`、`Workspace`、`Membership`。
2. 登录 token 改为 `uid/tid/wid/role/ver`。
3. 所有敏感接口增加 membership 查询。
4. `teacherScopeKey` 逐步退出认证核心。
5. 课堂能力迁移为工作区模块。

### 第三批：资源统一

1. 新增 `FileObject`。
2. 聊天附件、笔记图片、群聊文件、课堂文件迁移到统一授权。
3. 移除客户端裸 `ossKey` 下载能力。
4. 停止发布私有 `uploads`。

### 第四批：资源预算和运维

1. AI 生成统一限流和配额。
2. SSE 和 worker 取消机制。
3. WebSocket 连接上限。
4. Redis 计数 TTL 和恢复。
5. 日志脱敏和健康检查。

### 第五批：内网发布规范

1. 编写离线发布包脚本。
2. 编写服务器部署脚本。
3. 编写备份、迁移、健康检查和回滚脚本。
4. 固化 `/opt/educhat` 目录结构。
5. 发布包带版本号和校验文件。

## 通用平台 MVP

第一版通用平台建议控制范围：

- 多租户。
- 多工作区。
- 管理员邀请用户加入工作区。
- 工作区内聊天、笔记、文件、AI 生成。
- 可选课堂模块。
- 所有资源按 `tenantId/workspaceId/userId` 隔离。
- 管理员可配置 AI 配额和 provider。
- 关闭明文密码、默认密钥、裸 OSS key 下载、未鉴权笔记图片。
- 基础限流覆盖登录、找回密码、上传、AI、WebSocket。
- 支持内网离线 Docker 发布包。

## 最终验收清单

- 安全扫描中的 P0/P1 项已关闭。
- 所有用户资源都有租户和工作区归属。
- 所有文件下载都经过服务端对象归属校验。
- 生产环境没有默认密钥和默认数据库密码。
- 日志无敏感配置泄露。
- AI 和 WebSocket 有配额、限流和并发上限。
- 内网离线发布包可部署、可健康检查、可回滚。
- 数据库迁移可重复执行，并有发布前备份。
- 实验课堂逻辑已迁移为工作区课堂模块。

