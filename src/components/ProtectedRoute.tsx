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
  const effectiveRole = profile?.role;

  if (!isSupabaseConfigured) {
    return <>{children}</>;
  }

  // Show loading spinner only for a short time
  // If loading takes too long, AuthContext will use fallback profile
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
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
