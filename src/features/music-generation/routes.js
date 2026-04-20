import MusicGenerationPage from "./pages/MusicGenerationPage.jsx";

export const musicGenerationRoutes = [
  {
    path: "/music-generation",
    component: MusicGenerationPage,
    auth: "user",
  },
];
