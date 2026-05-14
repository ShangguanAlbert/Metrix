# 学生端历史作业管理模块设计

## 背景

当前学生端主页已经提供：

- `课堂任务`：按课时查看教师发布的任务与附件，并支持学生提交作业
- `座位选择`
- 元协坊、图片生成、派协作入口

现需在学生端新增一个独立模块 `历史作业管理`，放在学生左侧栏中，服务对象限定为 `上官福泽` 教师作用域下的学生。该模块用于让学生查看自己在每一节历史课中提交过什么作业，并下载自己历史提交的作业文件。该模块是只读模块，不提供提交、删除或修改入口。

## 目标

- 在学生左侧栏新增 `历史作业管理` 入口
- 学生进入后可查看教师课程计划中的历史课时
- 历史课时定义为：`已经开始过` 的课时，未来课时不显示
- 课时列表应覆盖教师课程计划里的所有历史课时，即使学生没有提交过作业也要显示
- 学生可查看某节历史课里自己提交过的全部作业文件
- 学生可下载自己历史提交的作业文件

## 非目标

- 不新增学生作业上传能力
- 不在该模块内显示“提交作业”“重新提交”“删除文件”“修改文件名”等写操作
- 不复用 `课堂任务` 模块中的任务说明正文、任务链接或任务附件展示
- 不新增独立数据库模型
- 不改教师端作业总览、导出和批量处理逻辑
- 不新增独立页面路由，先在现有学生主页单页切换中完成

## 用户范围与访问约束

- 仅对 `上官福泽` 教师作用域学生开放
- 继续沿用现有学生主页 [src/pages/ModeSelectionPage.jsx](/Users/fuze/Documents/GitHub/Metrix/src/pages/ModeSelectionPage.jsx) 的访问约束
- 非该 teacher scope 的学生仍按现有行为跳回聊天页，不额外开放该模块

## 现状与复用基础

### 前端现状

当前学生主页位于 [src/pages/ModeSelectionPage.jsx](/Users/fuze/Documents/GitHub/Metrix/src/pages/ModeSelectionPage.jsx)，已经具备：

- 左侧栏切换 `activePanel`
- 读取课时计划：`fetchClassroomTaskSettings()`
- 读取学生本人作业提交记录：`fetchClassroomHomeworkSubmissions()`
- 当前课时任务详情视图
- 学生作业上传与删除交互

### 后端现状

当前课堂用户路由位于 [server/routes/auth-user-classroom.js](/Users/fuze/Documents/GitHub/Metrix/server/routes/auth-user-classroom.js)，已经具备：

- `GET /api/classroom/tasks/settings`
- `GET /api/classroom/homework/submissions/me`
- `POST /api/classroom/homework/submissions/:lessonId/files`
- `DELETE /api/classroom/homework/submissions/:lessonId/files/:fileId`
- 教师端作业下载接口：`GET /api/auth/admin/classroom-homework/files/:fileId/download`

当前学生作业数据模型已存在：

- `ClassroomHomeworkFile`
- `normalizeClassroomHomeworkFileDoc(...)`

学生作业上传主路径当前已走 OSS：

- 上传时调用 `uploadStudentHomeworkFileToOss(...)`
- 数据中记录 `storageType = "oss"`、`ossKey`、`ossBucket`、`ossRegion`

## 方案总览

采用“在现有学生主页内部新增一个独立左侧模块”的方案：

- 左侧栏新增 `历史作业管理`
- 主区域新增一个历史作业视图
- 复用现有课时计划和学生提交记录数据
- 后端仅补一个“学生下载自己历史作业”的只读接口

该方案优点：

- 改动范围小
- 与现有学生端信息架构一致
- 不引入新的页面路由和新的数据模型
- 可以直接复用已有课时与作业元数据

## 信息架构

学生主页左侧栏新增一个同级入口：

- `课堂任务`
- `历史作业管理`
- `座位选择`
- `进入元协坊`
- `图片生成`
- `派 · 协作`

`历史作业管理` 与 `课堂任务` 必须是两个独立模块：

- `课堂任务` 继续负责当前课时任务查看和作业提交
- `历史作业管理` 只负责历史课时中的个人作业查看与下载

## 历史课时定义

历史课时筛选基于教师课程计划中的已开放课时，并按时间过滤：

- 先基于现有逻辑保留 `enabled !== false` 的课时
- 再保留 `courseStartAt` 对应时间 `<= 当前时间` 的课时
- 未来课时不出现在该模块中

时间判断优先使用现有 `courseStartAt`；若缺失，则沿用现有学生页中的课时时间解析逻辑进行兜底解析。排序沿用现有课时排序方式，默认选中“最近一节已开始课时”。

## 数据设计

### 数据来源

复用现有两个接口：

- `fetchClassroomTaskSettings()`
- `fetchClassroomHomeworkSubmissions()`

前端基于：

- `teacherCoursePlans`
- `submissionsByLesson`

生成历史作业视图所需的数据，不新增单独的“历史作业列表接口”。

### 视图层组合规则

对每一个历史课时：

- `lessonId` 来自课时计划
- `courseName`、`courseStartAt`、`courseEndAt`、`courseTime` 来自课时计划
- `submissions` 来自 `submissionsByLesson[lessonId]`

提交状态规则：

- 有文件：`已提交`
- 无文件：`未提交`

文件数量规则：

- `submissions.length`

## 前端交互设计

### 左侧栏行为

学生点击 `历史作业管理` 后：

- `activePanel` 切换到新的历史作业 panel key
- 不跳新路由
- 不打开新标签页

### 主区域布局

延续当前 `课堂任务` 模块的双栏布局：

- 左侧：历史课时列表
- 右侧：当前选中课时的历史作业详情

### 默认选中规则

进入模块后：

- 若存在历史课时，默认选中“最近一节已开始课时”
- 若用户已选中过仍存在的课时，则保留当前选择
- 若历史课时为空，则不选中任何课时

### 左侧历史课时列表

每个课时列表项显示：

- 课时名称
- 课时时间
- 提交状态：`已提交` / `未提交`
- 已提交时可显示文件数，例如 `已提交 2 份`

列表必须显示教师课程计划里的所有历史课时，不因学生未提交而隐藏。

### 右侧详情区

右侧只展示“该课时中当前学生自己的历史作业信息”，不重复课堂任务正文。

展示内容：

- 课时名称
- 上课时间
- 提交状态
- 已提交文件列表

已提交文件列表中每个文件显示：

- 文件名
- 文件大小
- 上传时间
- 下载按钮

### 空状态与只读约束

若学生未在该课时提交作业：

- 详情区显示 `未提交`
- 文件区域显示 `这节课你还没有提交作业。`

该模块中不出现以下控件：

- 提交作业按钮
- 添加文件按钮
- 删除按钮
- 文件重命名输入框
- 任何重新提交入口

## 下载设计

### 后端接口

新增学生端下载接口：

- `GET /api/classroom/homework/files/:fileId/download`

接口校验要求：

- 用户必须已登录
- `teacherScopeKey` 必须为 `SHANGGUAN_FUZE_TEACHER_SCOPE_KEY`
- 文件必须存在
- 文件的 `studentUserId` 必须与当前登录用户一致

### 下载返回约定

下载主路径按 OSS 模式设计，与现有教师下载作业接口一致：

- 若 `storageType === "oss"` 且存在有效 `ossKey`
  - 返回签名 `downloadUrl`
  - 同时返回 `fileName`、`mimeType`

保留二进制 fallback 分支以兼容仓库现有下载模式和历史异常数据：

- 若不是 OSS 或缺少可用签名链接，但存在本地二进制内容
  - 直接返回文件流

若以上都不可用：

- 返回明确错误

### 前端下载调用

在 [src/pages/classroom/classroomApi.js](/Users/fuze/Documents/GitHub/Metrix/src/pages/classroom/classroomApi.js) 新增 `downloadClassroomHomeworkFile(fileId, { fileKind })`

要求：

- 复用现有下载辅助逻辑
- `fileKind` 使用 `homework`
- 复用 [shared/classroomFileLabels.js](/Users/fuze/Documents/GitHub/Metrix/shared/classroomFileLabels.js) 中的命名和报错口径

## 状态与错误处理

### 页面级空状态

若筛选后没有任何历史课时：

- 左侧历史课时列表为空
- 右侧显示 `暂时还没有历史课时可查看。`

### 下载中状态

点击文件下载后：

- 当前文件按钮进入 `下载中...`
- 页面显示 `文件正在下载，请稍后。`
- 下载结束后恢复按钮状态

### 下载失败状态

下载失败时：

- 使用统一错误文案：`作业文件下载失败，请稍后重试。`
- 失败只影响当前下载动作
- 不阻断整个历史作业页面继续使用

## 实现边界

- 不新增新的后端存储模型
- 不改学生作业上传大小、数量或提交流程
- 不改教师端导出和作业总览逻辑
- 不改学生端 `课堂任务` 现有提交流程，仅拆分只读历史视图
- 不为了该功能引入新的全局状态管理

## 影响文件

预期主要变更文件：

- [src/pages/ModeSelectionPage.jsx](/Users/fuze/Documents/GitHub/Metrix/src/pages/ModeSelectionPage.jsx)
- [src/pages/classroom/classroomApi.js](/Users/fuze/Documents/GitHub/Metrix/src/pages/classroom/classroomApi.js)
- [server/routes/auth-user-classroom.js](/Users/fuze/Documents/GitHub/Metrix/server/routes/auth-user-classroom.js)

可能需要补充测试文件：

- `tests/` 下与课堂用户路由或课堂文件下载相关的测试

## 验证方案

最小验证要求：

- 后端测试覆盖学生下载自己历史作业：
  - 能下载自己的作业文件
  - 不能下载其他学生的作业文件
  - OSS 文件返回 `downloadUrl`
- 前端验证历史课时筛选逻辑：
  - 未来课时不显示
  - 历史课时全部显示
  - `已提交 / 未提交` 状态正确
- 前端验证该模块为只读：
  - 不出现上传按钮
  - 不出现删除按钮

建议执行的轻量检查：

- `node --test <新增或相关测试文件>`
- `npx eslint src/pages/ModeSelectionPage.jsx src/pages/classroom/classroomApi.js server/routes/auth-user-classroom.js`
- `node --check src/pages/classroom/classroomApi.js`
- `node --check server/routes/auth-user-classroom.js`

## 风险与注意事项

- 课时时间字段可能存在 `courseStartAt` 缺失或历史格式不一致，前端筛选必须复用现有解析逻辑，避免新旧模块判定不一致
- 若学生历史作业全部按 OSS 正常存储，主路径会稳定返回签名链接；但实现仍应兼容极少数非标准历史数据
- 历史模块与课堂任务模块共享部分课时数据，但交互目标完全不同，必须避免把“提交作业”相关状态误带入历史视图

## 实施建议

按以下顺序实施：

1. 先补学生下载历史作业接口和后端测试
2. 再补 `classroomApi.js` 下载方法
3. 最后在学生主页中新增 `历史作业管理` 视图与只读交互

这样可以先锁定数据和权限边界，再接前端页面。
