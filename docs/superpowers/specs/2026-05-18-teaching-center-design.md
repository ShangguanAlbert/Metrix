# 教师授课中心与课堂会话设计

日期：2026-05-18

## 1. 背景与目标

当前 EduChat 已经有较完整的教师端课时管理、课堂文件上传与学生端课堂入口：

- 教师端以 `teacherCoursePlans` 作为课时主数据，在 [src/pages/TeacherHomePage.jsx](/Users/fuze/Documents/GitHub/Metrix/src/pages/TeacherHomePage.jsx:1252) 和相关管理接口中维护。
- 学生端通过 `/api/classroom/tasks/settings` 读取同一份课时数据，在 [server/routes/auth-user-classroom.js](/Users/fuze/Documents/GitHub/Metrix/server/routes/auth-user-classroom.js:1111) 下发给学生。
- 课程文件与任务附件已经有独立文件上传链路和元数据修复链路，可复用为授课 PDF 的底层文件能力。

本设计的目标是在不引入第二套建课系统的前提下，为教师增加一个独立的“授课中心”和“课堂会话”能力：

- 教师仍然只在“课时管理”中创建和维护课时。
- “授课中心”自动镜像这些课时，并补充授课专属配置。
- 教师可以基于课时上传多个 PDF，选择当前授课文件并开始授课。
- 学生进入同一节课的课堂观看页，默认跟随教师，但允许临时自主翻页，并一键回到教师当前页。
- 教师中途退出后可以重新进入继续授课。
- 课后学生仍可自由查看本节课的课件内容。
- 实现必须从一开始就控制实时同步与 PDF 渲染带来的 CPU/内存压力，避免长时间挂机造成高内存、卡顿或泄漏。

## 2. 非目标

第一版不做以下内容：

- 不做音视频直播。
- 不做完整课堂聊天区。
- 不允许在授课中心新建课时。
- 不允许学生看到教师私有讲稿。
- 不将高频翻页状态持续写回整份 `teacherCoursePlans`。
- 不做课件编辑、标注回放、录播回放、课堂录屏等重能力。

## 3. 设计原则

### 3.1 单一课时数据源

- `teacherCoursePlans` 仍然是唯一课时主数据。
- 课时管理是唯一建课入口。
- 授课中心不创建、不复制、不迁移课时，只镜像展示并写入授课专属配置。

### 3.2 课时静态配置与授课动态状态分离

- 低频、稳定的配置挂在 `lesson` 上。
- 高频、易变化的授课状态单独存放。
- 避免教师翻页、学生互动频繁触发整份课堂配置对象保存。

### 3.3 会话可恢复但默认不自动延续旧进度

- 教师意外退出后，可以重新进入当前正在进行的授课会话。
- 如果教师显式结束了一次授课，下次再开始时默认回到默认 PDF 的第一页。
- 教师可以选择“恢复上次进度”，手动恢复到上一轮结束时的 PDF 和页码。

### 3.4 课后可查看

- 授课结束后，学生仍可自由查看本节课已发布的授课 PDF。
- 课后查看是只读浏览，不再参与实时跟随和课堂提问。

### 3.5 性能优先

- 实时同步必须采用“快照 + 增量推送”。
- PDF 只按需渲染当前页附近极少量页面。
- 页面切换、标签页隐藏、离开课堂、切换课时时必须主动释放订阅与文档资源。

## 4. 信息架构

### 4.1 教师端

教师主页新增一个独立 panel：`授课中心`。

现有分工：

- `课时管理`
  - 新建课时
  - 修改课名、时间、班级
  - 开关课时
  - 维护课程任务、课程文件
- `授课中心`
  - 展示从课时管理自动同步过来的课时列表
  - 配置授课专属字段
  - 启动和结束授课
  - 进入独立授课页

推荐在左侧导航中与 `课时管理` 并列增加 `授课中心`，沿用现有 `teacherPanel` 结构，不另起全新后台框架。

### 4.2 学生端

学生端保持“这是同一节课”的认知，不引入独立直播房间概念：

- 课时未开始授课：显示“教师尚未开始授课”
- 课时授课中：进入课堂观看页
- 课时已结束：进入课后只读查看页，阅读本节课 PDF

## 5. 数据模型设计

## 5.1 课时静态配置

在 `teacherCoursePlans[n]` 的 `lesson` 上新增 `teachingConfig` 子对象。

建议结构：

```js
{
  teachingConfig: {
    pdfFiles: [
      {
        fileId: "lesson-file-1",
        sortOrder: 0,
        enabled: true,
      },
    ],
    defaultPdfFileId: "lesson-file-1",
    allowQuestions: true,
    teacherNotes: "教师私有讲稿内容",
    welcomeText: "",
    updatedAt: "2026-05-18T12:00:00.000Z",
  },
}
```

说明：

- `pdfFiles` 不复制二进制文件，只引用现有 lesson file 的 `fileId`，并维护授课中心自己的排序与启用状态。
- `defaultPdfFileId` 指定这节课默认的授课课件。
- `allowQuestions` 控制学生观看页是否开放文字提问。
- `teacherNotes` 是教师私有字段，不下发给学生。
- `welcomeText` 作为可选字段保留，如果第一版不做学生欢迎文案，也可延后。

### 5.2 授课动态状态

新增单独的 `teachingSession` 状态对象，不能混在 `teacherCoursePlans` 中频繁整体保存。

建议结构：

```js
{
  sessionId: "session-20260518-001",
  lessonId: "lesson-1",
  teacherScopeKey: "shangguan-fuze",
  className: "810班",
  status: "idle", // idle | live | ended
  activePdfFileId: "lesson-file-1",
  activePage: 1,
  pageCount: 42,
  startedAt: "2026-05-18T12:10:00.000Z",
  endedAt: "",
  lastCheckpoint: {
    pdfFileId: "lesson-file-1",
    page: 18,
    savedAt: "2026-05-18T12:36:00.000Z",
  },
}
```

说明：

- `status=live` 表示当前存在一个可恢复的实时授课会话。
- `ended` 代表这次授课已显式结束，但仍保留 `lastCheckpoint` 供下次手动恢复。
- `lastCheckpoint` 是恢复上次进度的依据。

### 5.3 学生互动状态

学生互动状态与课时配置、授课状态进一步分离。

建议：

- `raisedHands`
  - 以 `lessonId + sessionId` 为 key 的短生命周期内存态
  - 只保留当前举手学生与更新时间
- `questions`
  - 单独轻量集合或模型
  - 结构包含 `lessonId`、`sessionId`、`studentUserId`、`content`、`createdAt`
  - 仅保存最近必要数据，并支持教师清空或课后清理

## 6. 教师端界面设计

### 6.1 课时管理页

课时管理维持现有职责，不挪走建课与课时基础设置。

建议增加两个轻量元素：

- 授课状态标签：`未配置 / 已配置 / 授课中`
- 跳转按钮：`前往授课中心`

这样教师在原有建课页能快速知道某节课是否已经完成授课准备。

### 6.2 授课中心页

授课中心分为左右两栏：

- 左栏：课时列表
  - 数据来源于同一份 `teacherCoursePlans`
  - 默认建议展示已开放课时，并支持切换“全部课时”
  - 显示班级、课时名、时间、授课状态
- 右栏：当前课时授课配置
  - PDF 列表
  - 上传/删除/排序
  - 指定默认授课 PDF
  - 学生提问开关
  - 教师私有讲稿编辑区
  - `保存配置`
  - `开始授课`

### 6.3 授课页

教师点击 `开始授课` 后进入独立授课页，而不是在后台原地授课。

推荐三栏结构：

- 左栏：本节课 PDF 列表，可切换当前授课文件
- 中栏：PDF 播放区，显示当前页
- 右栏：
  - 教师私有讲稿
  - 举手学生列表
  - 文字提问列表

顶部操作：

- 当前课时名
- 当前 PDF 名称
- 上一页 / 下一页 / 页码跳转
- 恢复上次进度
- 结束本次授课

## 7. 学生端界面设计

### 7.1 进入逻辑

学生从现有课堂入口进入对应课时的观看态。

页面根据会话状态分三种展示：

- `未开始`
  - 显示教师尚未开始授课
- `授课中`
  - 进入实时观看页
- `已结束`
  - 进入课后查看页，只读浏览本节课件

### 7.2 学生观看页

推荐双栏结构：

- 主区：PDF 阅读区
- 侧栏：
  - 举手按钮
  - 文字提问输入框
  - `回到教师当前页`
  - 跟随状态提示

### 7.3 弱同步规则

学生默认进入跟随态：

- 初次进入时，直接打开教师当前 PDF 和当前页
- 当学生自己翻页后，进入“暂时脱离跟随”状态
- 脱离期间，教师继续翻页不会强制跳转学生页面
- 学生点击 `回到教师当前页` 后重新进入跟随态

## 8. 会话生命周期与恢复规则

### 8.1 状态定义

- `idle`
  - 尚未开始当前授课
- `live`
  - 正在授课，可实时同步
- `ended`
  - 本次授课已结束，但保留恢复检查点与课后只读能力

### 8.2 启动授课

点击 `开始授课` 时：

- 如果没有进行中的 `live` 会话
  - 新建或重置会话
  - 默认打开 `defaultPdfFileId` 的第一页
- 如果存在当前 `live` 会话
  - 直接恢复进入该会话

### 8.3 意外退出恢复

如果教师因为刷新、网络抖动、标签页关闭等原因离开授课页：

- 会话状态不立刻结束
- 只要该课时 `live session` 仍存在，教师重新进入授课页就继续当前 `activePdfFileId + activePage`
- 服务端可为无人连接但未显式结束的 `live` 会话设置短暂保活窗口，例如数分钟

### 8.4 显式结束授课

教师点击 `结束本次授课` 时：

- 当前 `live` 会话转为 `ended`
- 保存 `lastCheckpoint`
- 学生端结束实时跟随，进入课后只读查看模式
- 互动输入区关闭

### 8.5 下次重新开始

下一次重新开始同一节课时：

- 默认从默认 PDF 的第一页开始
- 教师可手动点击 `恢复上次进度`
- 恢复逻辑使用 `lastCheckpoint`

## 9. 接口设计

### 9.1 教师端接口

- `GET /api/auth/admin/teaching-center/lessons`
  - 返回课时列表与授课配置摘要
  - 实际可复用 `teacherCoursePlans` 返回结构，不一定必须新增完全独立接口
- `PUT /api/auth/admin/classroom-plans/:lessonId/teaching-config`
  - 保存 `teachingConfig`
- `POST /api/auth/admin/classroom-plans/:lessonId/teaching-session/start`
  - 启动授课
- `POST /api/auth/admin/classroom-plans/:lessonId/teaching-session/end`
  - 结束授课
- `POST /api/auth/admin/classroom-plans/:lessonId/teaching-session/restore`
  - 手动恢复上次进度
- `POST /api/auth/admin/classroom-plans/:lessonId/teaching-session/page`
  - 更新当前页
- `POST /api/auth/admin/classroom-plans/:lessonId/teaching-session/pdf`
  - 切换当前授课 PDF

### 9.2 学生端接口

- `GET /api/classroom/teaching-session/:lessonId`
  - 返回会话快照
  - 用于首屏进入与可见性恢复后的对齐
- `POST /api/classroom/teaching-session/:lessonId/raise-hand`
  - 举手
- `POST /api/classroom/teaching-session/:lessonId/questions`
  - 提交问题

### 9.3 实时消息类型

推荐单一 lesson room，消息类型尽量收敛：

- `session_started`
- `session_ended`
- `page_changed`
- `pdf_changed`
- `hand_raised`
- `question_created`

## 10. 性能与内存约束

这是本设计的硬约束，不是优化项。

### 10.1 客户端

- 不允许全量轮询会话状态。
- 只允许“首屏获取 snapshot + WebSocket 增量更新”模式。
- `react-pdf` 只渲染当前页，必要时最多预取前后各 1 页。
- 不预渲染整本 PDF。
- 切换 PDF 时必须卸载旧 `Document` 与旧 canvas 资源。
- 教师端和学生端同一时刻只保留 1 个 lesson 订阅。
- 页面隐藏时暂停非必要渲染与动画。
- 恢复可见时重新拉一次 snapshot 对齐。
- 提问与举手列表限制条数，禁止无限增长。
- 教师讲稿自动保存必须做防抖，例如 600ms 到 1200ms。

### 10.2 服务端

- 翻页状态只写入轻量会话结构，不重写整份 `teacherCoursePlans`。
- 空房间实时状态要有清理策略。
- 显式结束授课时及时释放会话引用。
- 学生连接断开与教师连接断开都要从 room registry 中清除。
- 互动事件只广播增量，不重复下发整份历史列表。

### 10.3 长时间挂页保护

针对长时间开着 Chrome 标签页的场景：

- 客户端不能持续累积旧页 canvas、旧文档对象、旧订阅句柄。
- 房间重连后使用 snapshot 覆盖本地状态，避免本地累积历史 patch。
- 教师或学生切换到其他课时时，必须先 `unsubscribe` 再 `subscribe` 新房间。

## 11. 现有能力复用

### 11.1 可直接复用

- 课时主数据：`teacherCoursePlans`
- lesson file 文件上传链路
- 教师主页 panel 导航模式
- 学生端课时获取入口 `/api/classroom/tasks/settings`
- 现有 WebSocket / room 基础设施思路

### 11.2 不应复用的方式

以下内容不能直接沿用旧的“大对象整体保存”思路：

- 当前讲到第几页
- 当前 PDF 切换
- 举手列表
- 学生提问流

这些都属于高频授课态，必须单独建轻量状态。

## 12. 测试与验证

### 12.1 服务端测试

- `teachingConfig` 保存与读取
- 会话启动、结束、恢复规则
- `ended` 后默认从第一页开始
- `restore` 后能回到 `lastCheckpoint`
- 学生只能读取允许查看的字段，不能拿到 `teacherNotes`
- 学生端课后仍可查看课件
- 高频翻页不会修改整份课时配置对象

### 12.2 前端测试

- 授课中心列表正确镜像课时管理中的课时
- 课时管理新建后，授课中心可见
- 教师切换 PDF、翻页、恢复上次进度
- 学生弱同步：自主翻页后脱离跟随，点击按钮后重新跟随
- 课后查看模式只读有效

### 12.3 性能验证

- 单个教师页长时间打开不出现明显内存持续上涨
- 单个学生页长时间打开不累积无用 canvas
- 切换 PDF 前后内存能回落
- 标签页隐藏和恢复不会导致重复订阅
- 服务端在会话结束和断连后能清空 room 状态

## 13. 实施建议

建议分三步落地：

1. 先落 `授课中心 + teachingConfig`
   - 不碰实时
   - 完成课时镜像、多个 PDF、默认授课文件、教师私有讲稿
2. 再落 `teachingSession + 教师授课页 + 学生观看页`
   - 实现会话启动、翻页同步、弱同步
3. 最后补 `互动与性能验证`
   - 举手、提问、清理策略、长时间挂机验证

这样能避免一开始把文件、界面、会话、实时、互动全部缠在一起。

## 14. 风险与注意事项

- `teacherNotes` 如果直接放进学生通用接口回包，极易造成权限泄漏，必须严格区分 teacher/student payload。
- 如果授课 PDF 继续复用现有 lesson file，但没有明确区分“普通课程文件”和“授课 PDF”，UI 上可能混淆；实现时建议在 `teachingConfig.pdfFiles` 中显式引用。
- 如果直接在 `teacherCoursePlans` 上写入高频 `activePage`，未来课时配置保存、并发写入和刷新体验都会变差。
- 如果学生端为了方便直接渲染整本 PDF，长时间挂机时最容易出现内存上涨和卡顿，这一做法必须禁止。

## 15. 结论

本方案采用“课时管理单一建课入口 + 授课中心镜像课时并补充轻量授课配置 + 独立课堂会话状态”的结构：

- 满足教师端新增授课中心的产品诉求；
- 避免产生两套课时数据；
- 支持多 PDF 授课、教师私有讲稿、学生弱同步、课后可查看；
- 对网络抖动、误退出提供会话恢复能力；
- 从结构上规避实时同步与 PDF 渲染导致的长期高内存风险。
