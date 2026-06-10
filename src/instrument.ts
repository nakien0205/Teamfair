import * as Sentry from "@sentry/react";

const isProduction = import.meta.env.MODE === "production";
const hasDsn = Boolean(import.meta.env.VITE_SENTRY_DSN);

if (hasDsn) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      ...(isProduction
        ? [
            Sentry.replayIntegration({
              maskAllText: true,
              blockAllMedia: true,
            }),
          ]
        : []),
    ],
    // Tracing
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    tracePropagationTargets: ["localhost", import.meta.env.VITE_SUPABASE_URL].filter(Boolean),

    // Session Replay only in production to avoid noisy dev-time runtime issues.
    replaysSessionSampleRate: isProduction ? 0.1 : 0,
    replaysOnErrorSampleRate: isProduction ? 1.0 : 0,

    enabled: hasDsn,
  });
}
