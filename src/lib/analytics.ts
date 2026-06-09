import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY?.trim();
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";

let initialized = false;

type AnalyticsProperties = Record<string, unknown>;

function canUseAnalytics(): boolean {
  return Boolean(POSTHOG_KEY && import.meta.env.PROD);
}

export function initAnalytics(): void {
  if (initialized || !canUseAnalytics()) return;

  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: true,
      capture_pageview: "history_change",
      capture_pageleave: true,
      persistence: "localStorage",
      disable_session_recording: false,
    });
    initialized = true;
  } catch (error) {
    console.warn("PostHog analytics failed to initialize:", error);
  }
}

export function identifyUser(userId: string, traits?: AnalyticsProperties): void {
  if (!initialized) return;

  try {
    posthog.identify(userId, traits);
  } catch (error) {
    console.warn("PostHog user identification failed:", error);
  }
}

export function trackEvent(event: string, properties?: AnalyticsProperties): void {
  if (!initialized) return;

  try {
    posthog.capture(event, properties);
  } catch (error) {
    console.warn(`PostHog event capture failed for "${event}":`, error);
  }
}

export function resetAnalytics(): void {
  if (!initialized) return;

  try {
    posthog.reset();
  } catch (error) {
    console.warn("PostHog analytics reset failed:", error);
  }
}
