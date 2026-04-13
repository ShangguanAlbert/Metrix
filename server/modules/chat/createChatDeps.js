import * as llm from "../../platform/llm/index.js";

export function createChatDeps(rootDeps) {
  return {
    legacyRegistrarDeps: rootDeps,
    moduleName: "chat",
    llm,
  };
}
