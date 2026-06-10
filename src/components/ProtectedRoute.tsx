import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type AppUserRole } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { dashboardPathForRole } from "@/lib/dashboardPath";

type Props = {
  children: React.ReactNode;
  allowedRoles?: AppUserRole[];
};

const ProtectedRoute = ({ children, allowedRoles }: Props) => {
  const { session, profile, loading } = useAuth();
  const location = useLocation();
  const effectiveRole = profile?.role;

  if (!isSupabaseConfigured) {
    return <>{children}</>;
  }

  // Show loading spinner only for a short time
  // If loading takes too long, AuthContext will use fallback profile
  if (loading) {
    // Keep auth loading visually quiet so the page's own skeleton can own the loading state.
    return <>{children}</>;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles?.length && (!effectiveRole || !allowedRoles.includes(effectiveRole))) {
    return <Navigate to={dashboardPathForRole(effectiveRole || "student")} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
