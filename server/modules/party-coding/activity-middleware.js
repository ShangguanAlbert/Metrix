// Observe completed requests. This middleware never delays or changes their response.
export function partyActivityMiddleware(deps) {
  return (req, res, next) => {
    const pathname = req.path;
    const match = pathname.match(/^\/api\/group-chat\/rooms\/([a-f0-9]{24})(.*)$/i);
    const homework = pathname.match(/^\/api\/classroom\/homework\/submissions\/([^/]+)\/files/);
    if ((!match && !homework) || pathname.endsWith("/activity")) return next();
    let response;
    const original = res.json;
    res.json = function (body) { response = body; return original.call(this, body); };
    res.once("finish", () => {
      if (!req.authUser || req.authTeacherScopeKey !== "shi-gaojun") return;
      const userId = String(req.authUser._id);
      const userName = req.authUser.profile?.name || req.authUser.username;
      const succeeded = res.statusCode < 400;
      const suffix = match?.[2] || "";
      let eventType;
      if (suffix === "/messages/image" && req.method === "POST") eventType = "chat_image";
      if (suffix === "/messages/file" && req.method === "POST") eventType = "chat_file";
      if (suffix.endsWith("/reactions/toggle")) eventType = "message_reaction";
      if (suffix.includes("/messages/") && req.method === "DELETE") eventType = "message_deleted";
      if (suffix.endsWith("/download")) eventType = "material_download";
      if (suffix === "/read") eventType = "message_read_cursor";
      if (suffix === "/coding/images" && req.method === "POST") eventType = "coding_image_upload";
      if (homework && req.method === "POST") eventType = "homework_submitted";
      if (homework && req.method === "DELETE") eventType = "homework_deleted";
      if (!succeeded && req.method !== "GET") eventType = "operation_failed";
      if (!eventType) return;
      const metadata = { path: pathname, method: req.method, status: res.statusCode,
        messageId: response?.message?.id || suffix.match(/\/messages\/([^/]+)/)?.[1] || req.body?.messageId || "",
        replyToMessageId: response?.message?.replyToMessageId || req.body?.replyToMessageId || "",
        emoji: req.body?.emoji, reactions: response?.reactions,
        lessonId: homework?.[1],
        file: response?.message?.file ? { fileId: response.message.file.fileId, fileName: response.message.file.fileName, size: response.message.file.size } : undefined,
        image: response?.message?.image ? { fileName: response.message.image.fileName, size: response.message.image.size } : undefined,
        resultFileIds: (response?.files || response?.submission?.files || []).map((file) => file.id || file._id),
      };
      const record = (roomId) => deps.partyActivity.record({ roomId, userId, userName, eventType, metadata });
      if (match) record(match[1]);
      else void deps.GroupChatRoom.find({ teacherScopeKey: "shi-gaojun", memberUserIds: userId }, { _id: 1 }).lean()
        .then((rooms) => rooms.forEach((room) => record(String(room._id))))
        .catch((error) => console.error("[party-activity] homework association failed", error.message));
    });
    next();
  };
}
