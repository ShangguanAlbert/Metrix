import { registerMusicHistoryRoutes } from "./services/history.js";
import { registerMusicGenerationRoutes } from "./services/generate.js";

export function registerMusicRoutes(app, deps) {
  registerMusicGenerationRoutes(app, deps);
  registerMusicHistoryRoutes(app, deps);
}
