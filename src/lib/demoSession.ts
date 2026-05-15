const DEMO_SESSION_KEY = "teamfair_demo_session";

export function setDemoSession(): void {
  sessionStorage.setItem(DEMO_SESSION_KEY, "true");
}

export function clearDemoSession(): void {
  sessionStorage.removeItem(DEMO_SESSION_KEY);
}

export function isDemoSession(): boolean {
  return sessionStorage.getItem(DEMO_SESSION_KEY) === "true";
}
