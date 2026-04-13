import ImageGenerationPage from "./pages/ImageGenerationPage.jsx";

export const imageGenerationRoutes = [
  {
    path: "/image-generation",
    component: ImageGenerationPage,
    auth: "user",
  },
  {
    path: "/image-generation/:libraryView",
    component: ImageGenerationPage,
    auth: "user",
  },
];
