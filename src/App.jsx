import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import AdminSettingsPage from "./pages/AdminSettingsPage.jsx";
import ImageGenerationPage from "./pages/ImageGenerationPage.jsx";
import PartyChatPage from "./pages/PartyChatPage.jsx";
import RequireAuth from "./app/RequireAuth.jsx";
import RequireAdminAuth from "./app/RequireAdminAuth.jsx";
import { resolveActiveAuthSlot, syncAuthSlotFromLocation, withAuthSlot } from "./app/authStorage.js";

export default function App() {
  const location = useLocation();
  const activeSlot = resolveActiveAuthSlot(location.search);

  useEffect(() => {
    syncAuthSlotFromLocation(location.search);
  }, [location.search]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/chat"
        element={
          <RequireAuth>
            <ChatPage />
          </RequireAuth>
        }
      />

      <Route
        path="/image-generation"
        element={
          <RequireAuth>
            <ImageGenerationPage />
          </RequireAuth>
        }
      />

      <Route
        path="/party"
        element={
          <RequireAuth>
            <PartyChatPage />
          </RequireAuth>
        }
      />

      <Route
        path="/admin/settings"
        element={
          <RequireAdminAuth>
            <AdminSettingsPage />
          </RequireAdminAuth>
        }
      />

      <Route path="*" element={<Navigate to={withAuthSlot("/login", activeSlot)} replace />} />
    </Routes>
  );
}
