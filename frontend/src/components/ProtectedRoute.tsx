import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, role }) => {
  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("role");

  // Not logged in → go to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but wrong role → go to THEIR dashboard
  if (role && userRole !== role) {
    return userRole === "doctor"
      ? <Navigate to="/doctor" replace />
      : <Navigate to="/patient" replace />;
  }

  return children;
};

export default ProtectedRoute;
