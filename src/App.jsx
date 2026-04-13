import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import RequireAdminAuth from "./app/RequireAdminAuth.jsx";
import RequireAuth from "./app/RequireAuth.jsx";
import { resolveActiveAuthSlot, syncAuthSlotFromLocation } from "./app/authStorage.js";
import { appRoutes } from "./app/routes/index.js";

function renderRouteElement(route, activeSlot) {
  const element = route.redirectTo ? (
    <Navigate to={route.redirectTo({ activeSlot })} replace />
  ) : route.component ? (
    <route.component />
  ) : null;

  if (route.auth === "user") {
    return <RequireAuth>{element}</RequireAuth>;
  }
  if (route.auth === "admin") {
    return <RequireAdminAuth>{element}</RequireAdminAuth>;
  }
  return element;
}

export default function App() {
  const location = useLocation();
  const activeSlot = resolveActiveAuthSlot(location.search);

  useEffect(() => {
    syncAuthSlotFromLocation(location.search);
  }, [location.search]);

  return (
    <Routes>
      {appRoutes.map((route) => (
        <Route
          key={`${route.auth || "public"}:${route.path}`}
          path={route.path}
          element={renderRouteElement(route, activeSlot)}
        />
      ))}
    </Routes>
  );
}
