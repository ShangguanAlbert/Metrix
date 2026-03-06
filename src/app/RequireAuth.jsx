import { Navigate, useLocation } from "react-router-dom";
import { getUserToken, resolveActiveAuthSlot, withAuthSlot } from "./authStorage.js";

export default function RequireAuth({ children }) {
  const location = useLocation();
  const activeSlot = resolveActiveAuthSlot(location.search);
  const token = getUserToken(activeSlot);

  if (!token) {
    // 记住用户原本想去的页面，未来接真实登录时可以“登录后跳回去”
    return <Navigate to={withAuthSlot("/login", activeSlot)} replace state={{ from: location }} />;
  }

  return children;
}
