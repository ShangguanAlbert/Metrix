import { createFilteredRouteApp } from "../../platform/route-filter-app.js";
import { registerChatAndImageRoutes } from "../../routes/chat-and-images.js";

function isChatRoutePath(routePath) {
  if (typeof routePath !== "string") {
    return true;
  }
  return routePath.startsWith("/api/chat/") || routePath.startsWith("/api/auth/admin/");
}

export function registerChatRoutes(app, deps) {
  const filteredApp = createFilteredRouteApp(app, isChatRoutePath);
  registerChatAndImageRoutes(filteredApp, deps.legacyRegistrarDeps);
}
