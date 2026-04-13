import LicensePage from "./pages/LicensePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";

export const authRoutes = [
  {
    path: "/login",
    component: LoginPage,
    auth: "public",
  },
  {
    path: "/license",
    component: LicensePage,
    auth: "public",
  },
];
