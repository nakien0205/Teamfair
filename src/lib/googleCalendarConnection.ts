import { supabase } from './supabaseClient';

export interface GoogleCalendarConnectionView {
  status: 'not_connected' | 'consent_pending' | 'connected' | 'attention_needed' | 'disconnecting' | 'disconnected';
  optedIn: boolean;
  grantedScopes: string[];
  connectionGeneration: number;
  attentionCode: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
}

/**
 * Cleanly parses and sanitizes server response to ensure browser state never contains extra or raw credential fields
 */
export function sanitizeConnectionView(data: any): GoogleCalendarConnectionView {
  if (!data || typeof data !== 'object') {
    return {
      status: 'disconnected',
      optedIn: false,
      grantedScopes: [],
      connectionGeneration: 0,
      attentionCode: null,
      connectedAt: null,
      updatedAt: null
    };
  }

  const validStatuses = ['not_connected', 'consent_pending', 'connected', 'attention_needed', 'disconnecting', 'disconnected'];
  const status = validStatuses.includes(data.status) ? data.status : 'disconnected';

  return {
    status: status as GoogleCalendarConnectionView['status'],
    optedIn: Boolean(data.optedIn),
    grantedScopes: Array.isArray(data.grantedScopes) ? data.grantedScopes.map(String) : [],
    connectionGeneration: Math.max(0, Number(data.connectionGeneration) || 0),
    attentionCode: data.attentionCode ? String(data.attentionCode) : null,
    connectedAt: data.connectedAt ? String(data.connectedAt) : null,
    updatedAt: data.updatedAt ? String(data.updatedAt) : null
  };
}

/**
 * Initiates OAuth consent flow for eligible account owner
 */
export async function startGoogleCalendarAuthorization(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const { data, error } = await supabase.functions.invoke('google-calendar-connection/authorize', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  if (error || !data?.authorizationUrl) {
    throw new Error(error?.message || 'Failed to generate authorization URL');
  }

  return data.authorizationUrl;
}

/**
 * Fetches browser-safe connection view
 */
export async function fetchGoogleCalendarConnectionStatus(): Promise<GoogleCalendarConnectionView> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const { data, error } = await supabase.functions.invoke('google-calendar-connection/status', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  if (error) {
    return sanitizeConnectionView(null);
  }

  return sanitizeConnectionView(data);
}

/**
 * Updates explicit task-sync opt-in preference
 */
export async function setGoogleCalendarOptIn(enabled: boolean): Promise<GoogleCalendarConnectionView> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const { data, error } = await supabase.functions.invoke('google-calendar-connection/set_opt_in', {
    body: { enabled },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  if (error) {
    throw new Error(error.message || 'Failed to update opt-in state');
  }

  return sanitizeConnectionView(data);
}

/**
 * Disconnects Google Calendar, clearing credentials and fencing operations
 */
export async function disconnectGoogleCalendar(): Promise<GoogleCalendarConnectionView> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const { data, error } = await supabase.functions.invoke('google-calendar-connection/disconnect', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  if (error) {
    throw new Error(error.message || 'Failed to disconnect Google Calendar');
  }

  return sanitizeConnectionView(data);
}
