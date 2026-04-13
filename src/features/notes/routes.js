import NotesPage from "./pages/NotesPage.jsx";

export const notesRoutes = [
  {
    path: "/notes",
    component: NotesPage,
    auth: "user",
  },
  {
    path: "/notes/:noteId",
    component: NotesPage,
    auth: "user",
  },
];
