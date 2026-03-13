import express from "express";
import multer from "multer";
import http from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { createAppContext } from "./app/createAppContext.js";
import { createStartupTasks } from "./app/startup-tasks.js";
import { registerAuthUserClassroomRoutes } from "./routes/auth-user-classroom.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerChatAndImageRoutes } from "./routes/chat-and-images.js";
import { registerGroupChatRoutes } from "./routes/group-chat.js";
import { createGroupChatRealtimeHub } from "./runtime/group-chat-realtime-hub.js";

const app = express();
const deps = createAppContext();
const startupTasks = createStartupTasks(deps);
const groupChatRealtimeHub = createGroupChatRealtimeHub(deps);

registerAuthUserClassroomRoutes(app, deps);
registerAdminRoutes(app, deps);
registerChatAndImageRoutes(app, deps);
registerGroupChatRoutes(app, deps);

const distDir = path.resolve(process.cwd(), "dist");
const distIndexHtml = path.join(distDir, "index.html");
if (existsSync(distIndexHtml)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(distIndexHtml);
  });
}

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "文件过大，请压缩后重试。" });
      return;
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      res.status(413).json({ error: "文件数量超过限制，请减少上传数量后重试。" });
      return;
    }
    res.status(400).json({ error: `上传失败: ${error.code}` });
    return;
  }

  res.status(500).json({ error: error?.message || "unknown server error" });
});

async function startServer() {
  await deps.mongoose.connect(deps.mongoUri, { serverSelectionTimeoutMS: 6000 });
  console.log(`Mongo connected: ${deps.mongoUri}`);
  await deps.ensureFixedAdminAccounts();
  await deps.ensureFixedStudentAccounts();

  const server = http.createServer(app);
  groupChatRealtimeHub.initWebSocketServer(server);

  server.listen(deps.port, () => {
    console.log(`API server listening on http://localhost:${deps.port}`);
    console.log(
      `Group chat websocket listening on ws://localhost:${deps.port}${deps.GROUP_CHAT_WS_PATH}`,
    );
  });

  void startupTasks.run();
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
