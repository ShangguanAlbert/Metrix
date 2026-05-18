import { buildAdminHomeRedirect } from "../../app/routes/navigationTargets.js";
import AdminClassroomSettingsPage from "./pages/AdminClassroomSettingsPage.jsx";
import AdminOnlineUsersPage from "./pages/AdminOnlineUsersPage.jsx";
import AdminSettingsPage from "./pages/AdminSettingsPage.jsx";
import TeacherHomePage from "./pages/TeacherHomePage.jsx";
import TeacherTeachingSessionPage from "../classroom/pages/TeacherTeachingSessionPage.jsx";

export const adminRoutes = [
  {
    path: "/admin/settings",
    component: TeacherHomePage,
    auth: "admin",
  },
  {
    path: "/admin/agent-settings",
    component: AdminSettingsPage,
    auth: "admin",
  },
  {
    path: "/admin/classroom-settings",
    component: AdminClassroomSettingsPage,
    auth: "admin",
  },
  {
    path: "/admin/online-users",
    component: AdminOnlineUsersPage,
    auth: "admin",
  },
  {
    path: "/admin/agent-lab",
    auth: "admin",
    redirectTo: ({ activeSlot }) => buildAdminHomeRedirect(activeSlot),
  },
  {
    path: "/admin/classroom/teaching/:lessonId",
    component: TeacherTeachingSessionPage,
    auth: "admin",
  },
];
