import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  // Tracing
  tracesSampleRate: import.meta.env.MODE === "production" ? 0.1 : 1.0,
  tracePropagationTargets: ["localhost", import.meta.env.VITE_SUPABASE_URL].filter(Boolean),

  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  enabled: !!import.meta.env.VITE_SENTRY_DSN,
});
