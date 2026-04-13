import ChatEntryPage from "./pages/ChatEntryPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";

export const chatRoutes = [
  {
    path: "/chat",
    component: ChatEntryPage,
    auth: "user",
  },
  {
    path: "/chat/:sessionId",
    component: ChatEntryPage,
    auth: "user",
  },
  {
    path: "/c",
    component: ChatPage,
    auth: "user",
  },
  {
    path: "/c/:sessionId",
    component: ChatPage,
    auth: "user",
  },
];
