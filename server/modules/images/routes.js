import { registerImageHistoryRoutes } from "./services/history.js";
import { registerImageStreamRoutes } from "./services/stream.js";

export function registerImageRoutes(app, deps) {
  registerImageStreamRoutes(app, deps);
  registerImageHistoryRoutes(app, deps);
}
