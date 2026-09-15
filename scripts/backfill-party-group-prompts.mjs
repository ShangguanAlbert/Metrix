import dotenv from "dotenv";
import mongoose from "mongoose";
import process from "node:process";
import { DEFAULT_GROUP_CHAT_AI_CONFIG, sanitizeGroupChatAiConfig } from "../server/services/group-chat-ai-config.js";

dotenv.config({ quiet: true });
const apply = process.argv.includes("--apply");
try {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/educhat");
  const collection = mongoose.connection.db.collection("admin_configs");
  const doc = await collection.findOne({ key: "global" });
  const current = String(doc?.groupChatAiConfig?.systemPrompt || "");
  const next = sanitizeGroupChatAiConfig({ systemPrompt: current }).systemPrompt;
  // Only migrate recognized, stored defaults. Never overwrite a custom prompt.
  const eligible = Boolean(current && next !== current && next === DEFAULT_GROUP_CHAT_AI_CONFIG.systemPrompt
    && !current.includes("苏格拉底式 Python 学习导师"));
  let modifiedCount = 0;
  if (apply && eligible) {
    const result = await collection.updateOne({ _id: doc._id, "groupChatAiConfig.systemPrompt": current }, {
      $set: { "groupChatAiConfig.systemPrompt": next },
    });
    modifiedCount = result.modifiedCount;
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "check", recognizedStoredDefault: eligible,
    customOrCurrentPromptPreserved: !eligible, modifiedCount }));
} finally {
  await mongoose.disconnect();
}
