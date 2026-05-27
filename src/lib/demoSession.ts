const DEMO_SESSION_KEY = "teamfair_demo_session";

export function setDemoSession(): void {
  // Demo session is completely disabled. Do not write to sessionStorage.
}

export function clearDemoSession(): void {
  sessionStorage.removeItem(DEMO_SESSION_KEY);
}

export function isDemoSession(): boolean {
  return false;
}
