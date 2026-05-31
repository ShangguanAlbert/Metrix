import {
  buildModeSelectionPanelRedirect,
  buildModeSelectionRedirect,
} from "../../app/routes/navigationTargets.js";
import ModeSelectionPage from "./pages/ModeSelectionPage.jsx";

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
    auth: "user",
    redirectTo: ({ activeSlot }) => buildModeSelectionPanelRedirect(activeSlot, "final-test"),
  },
  {
    path: "/agent-lab",
    auth: "user",
    redirectTo: ({ activeSlot }) => buildModeSelectionRedirect(activeSlot),
  },
];
