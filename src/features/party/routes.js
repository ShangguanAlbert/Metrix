import PartyChatPage from "./pages/PartyChatPage.jsx";

export const partyRoutes = [
  {
    path: "/party",
    component: PartyChatPage,
    auth: "user",
  },
];
