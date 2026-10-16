// Browser observations describe observable actions, never inferred understanding.
export const PARTY_CLIENT_EVENTS = Object.freeze([
  "session_start", "session_end", "session_heartbeat", "page_visibility", "page_focus",
  "connection_status", "task_view", "material_open", "material_download", "material_download_failed",
  "document_view", "editor_action", "preview_open", "preview_close", "message_visible",
  "message_copy", "image_view", "ui_action", "client_capture_error",
]);

export const PARTY_EVENT_LABELS = Object.freeze({
  session_start: "进入课堂", session_end: "离开课堂", session_heartbeat: "会话心跳",
  page_visibility: "页面可见性", page_focus: "页面焦点", connection_status: "连接状态",
  task_view: "任务呈现", material_open: "打开材料", material_download: "下载材料",
  material_download_failed: "材料下载失败", document_view: "切换代码文件", editor_action: "编辑操作",
  preview_open: "打开预览", preview_close: "关闭预览", message_visible: "消息进入视野",
  message_copy: "复制消息内容", image_view: "查看图片", ui_action: "界面操作",
  chat_message: "群聊发言", chat_image: "图片消息", chat_file: "文件消息", message_reaction: "表情回应",
  message_deleted: "删除消息", code_edit: "代码保存", code_transaction: "代码变更",
  preview: "刷新预览", diagnostic_error: "诊断问题", task_switch: "任务或区域切换",
  template_load: "载入模板", task_stage_change: "阶段切换", role_rotation: "角色交接",
  paia_intervention: "AI 主动提醒", paia_feedback: "学生反馈", ai_response: "AI 回复",
  message_read_cursor: "消息已读位置", coding_image_upload: "上传编程图片", operation_failed: "操作失败",
  member_account_deleted: "成员账号删除",
  room_archived: "小组归档", task_published: "课时发布", homework_submitted: "提交作业",
  homework_deleted: "删除作业", client_capture_error: "采集异常", record_failure: "记录异常",
});
