import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
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

  if (!isSupabaseConfigured) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profile && !profile.profile_completed && location.pathname !== "/projects") {
    return <Navigate to="/projects" replace />;
  }

  if (allowedRoles?.length && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to={dashboardPathForRole(profile.role)} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
