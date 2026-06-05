import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, RefreshCw, User } from "lucide-react";

/**
 * Debug component to show profile loading status
 * Only show in development mode
 * Usage: Add <DebugProfileStatus /> to your layout in dev
 */
const DebugProfileStatus = () => {
  const { session, user, profile, loading, refreshProfile } = useAuth();

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 border-2 border-indigo-200 bg-white p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <User className="h-4 w-4" />
          Profile Debug
        </h3>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => void refreshProfile()}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="space-y-2 text-xs">
        {/* Loading Status */}
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Loading:</span>
          {loading ? (
            <Badge className="bg-amber-100 text-amber-700">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Loading
            </Badge>
          ) : (
            <Badge className="bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Ready
            </Badge>
          )}
        </div>

        {/* Session Status */}
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Session:</span>
          {session ? (
            <Badge className="bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Active
            </Badge>
          ) : (
            <Badge className="bg-slate-200 text-slate-700">
              <XCircle className="mr-1 h-3 w-3" />
              None
            </Badge>
          )}
        </div>

        {/* User Status */}
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Auth User:</span>
          {user ? (
            <Badge className="bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Found
            </Badge>
          ) : (
            <Badge className="bg-slate-200 text-slate-700">
              <XCircle className="mr-1 h-3 w-3" />
              None
            </Badge>
          )}
        </div>

        {/* Profile Status */}
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Profile:</span>
          {profile ? (
            <Badge className="bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Loaded
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-700">
              <XCircle className="mr-1 h-3 w-3" />
              Missing
            </Badge>
          )}
        </div>

        {/* Profile Details */}
        {profile && (
          <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Role:</span>
              <span className="font-medium text-slate-900">{profile.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Name:</span>
              <span className="font-medium text-slate-900 truncate max-w-[150px]" title={profile.full_name}>
                {profile.full_name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Email:</span>
              <span className="font-medium text-slate-900 truncate max-w-[150px]" title={profile.email}>
                {profile.email}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Completed:</span>
              {profile.profile_completed ? (
                <Badge className="h-5 bg-emerald-100 text-emerald-700">Yes</Badge>
              ) : (
                <Badge className="h-5 bg-amber-100 text-amber-700">No</Badge>
              )}
            </div>
          </div>
        )}

        {/* Fallback Warning */}
        {profile && !profile.profile_completed && (
          <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            ⚠️ Using fallback profile from auth metadata
          </div>
        )}

        {/* User ID */}
        {user && (
          <div className="mt-2 rounded-lg bg-slate-50 p-2">
            <span className="block text-slate-500">User ID:</span>
            <code className="block break-all text-[10px] text-slate-700">{user.id}</code>
          </div>
        )}
      </div>

      <div className="mt-3 text-[10px] text-slate-400">
        Press F12 → Console for detailed logs
      </div>
    </Card>
  );
};

export default DebugProfileStatus;
