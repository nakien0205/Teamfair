import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FallbackProps {
  error: Error;
  componentStack: string | null;
  resetError: () => void;
}

export const SentryErrorBoundaryFallback: React.FC<FallbackProps> = ({ error, resetError }) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center">
          <div className="rounded-full bg-destructive/10 p-4 text-destructive ring-8 ring-destructive/5 animate-pulse">
            <AlertTriangle className="h-12 w-12" />
          </div>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An unexpected error occurred in Teamfair. We have logged this issue and our team is looking into it.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-border bg-card p-4 text-left shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Error Details</p>
            <p className="mt-1 text-sm font-mono text-destructive break-all select-all">
              {error.message || "Unknown error"}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => {
              resetError();
              window.location.reload();
            }}
            variant="default"
            className="inline-flex items-center gap-2 px-5 py-2 transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Page
          </Button>
          <Button
            onClick={() => {
              window.location.href = "/";
            }}
            variant="outline"
            className="transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            Go to Landing Page
          </Button>
        </div>
      </div>
    </div>
  );
};
export default SentryErrorBoundaryFallback;
