// One ordinary JSON array per collection. Export scope is authorized room IDs,
// independent of the teacher's current page, date range, or event filters.
export const PARTY_EXPORT_COLLECTIONS = Object.freeze([
  "party_learning_events", "party_code_archive", "party_source_archive", "party_web_workspaces",
  "party_paia_interventions", "party_memory_uses", "party_course_memories", "party_course_memory_candidates",
  "party_paia_memories", "party_paia_memory_candidates", "party_memory_compilation_states",
  "party_room_archives", "group_chat_messages", "group_chat_ai_tasks", "group_chat_files", "party_coding_images",
  "group_chat_rooms",
]);

export async function buildPartyActivityExportFiles(deps, authorizedRoomIds, { prefix = "" } = {}) {
  const roomIds = [...new Set(authorizedRoomIds)];
  const startedAt = new Date().toISOString();
  await deps.partyActivity?.flush();
  await deps.partyActivity?.drain();
  const files = [];
  const counts = {};
  for (const collection of PARTY_EXPORT_COLLECTIONS) {
    const filter = collection === "group_chat_rooms"
      ? { _id: { $in: roomIds.map((value) => new deps.mongoose.Types.ObjectId(value)) } }
      : { roomId: { $in: roomIds } };
    const sort = collection === "party_learning_events" ? { occurredAt: 1, _id: 1 } : { _id: 1 };
    const rows = [];
    for await (const document of deps.mongoose.connection.db.collection(collection).find(filter).sort(sort)) {
      rows.push(JSON.stringify(document));
    }
    counts[collection] = rows.length;
    files.push({ name: `${prefix}${collection}.json`, content: `[\n${rows.join(",\n")}\n]\n` });
  }
  const manifest = {
    format: "metrix-learning-process-json-v1", startedAt, finishedAt: new Date().toISOString(), roomIds,
    counts, totalRecords: Object.values(counts).reduce((total, count) => total + count, 0),
    recording: await deps.partyActivity?.status() || null,
    notes: [
      "包含所选授权小组的全部已保存记录，不受界面筛选、分页、200条事件或20个版本上限限制；空类型保留空数组。",
      "会话、任务材料使用、编辑、预览和协作行为见 party_learning_events；原始聊天、代码增量、干预和记忆记录通过 roomId、messageId、eventId 等字段关联。",
      "附件导出已保存的元数据、对象存储引用或数据库内嵌数据；不会额外下载外部网页或对象存储文件。",
      "消息可见和材料下载不代表阅读或理解；AI 后续操作关联不代表确认采纳。此前未采集或已丢失的数据不能补回。",
      "导出期间课堂可继续使用，各文件按读取时的数据库内容生成，不是跨集合事务快照。客户端离线未补传的数据不在本包中。",
      "recording 为当前应用进程的待同步状态，AI worker 队列需另行检查；有待同步记录时应稍后重新导出。",
    ],
  };
  return [{ name: `${prefix}manifest.json`, content: JSON.stringify(manifest, null, 2) }, ...files];
}
