import { buildModeSelectionRedirect } from "../../app/routes/navigationTargets.js";
import ModeSelectionPage from "./pages/ModeSelectionPage.jsx";
import ProductImprovementTaskPage from "./pages/ProductImprovementTaskPage.jsx";

export const classroomRoutes = [
  {
    path: "/mode-selection",
    component: ModeSelectionPage,
    auth: "user",
  },
  {
    path: "/classroom/tasks",
    auth: "user",
    redirectTo: ({ activeSlot }) => buildModeSelectionRedirect(activeSlot),
  },
  {
    path: "/classroom/tasks/product-improvement",
    component: ProductImprovementTaskPage,
    auth: "user",
  },
  {
    path: "/agent-lab",
    auth: "user",
    redirectTo: ({ activeSlot }) => buildModeSelectionRedirect(activeSlot),
  },
];
