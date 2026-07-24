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
export function sanitizeConnectionView(data: unknown): GoogleCalendarConnectionView {
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

  const d = data as Record<string, unknown>;
  const validStatuses = ['not_connected', 'consent_pending', 'connected', 'attention_needed', 'disconnecting', 'disconnected'];
  const rawStatus = typeof d.status === 'string' ? d.status : '';
  const status = validStatuses.includes(rawStatus) ? rawStatus : 'disconnected';

  return {
    status: status as GoogleCalendarConnectionView['status'],
    optedIn: Boolean(d.optedIn),
    grantedScopes: Array.isArray(d.grantedScopes) ? d.grantedScopes.map(String) : [],
    connectionGeneration: Math.max(0, Number(d.connectionGeneration) || 0),
    attentionCode: d.attentionCode ? String(d.attentionCode) : null,
    connectedAt: d.connectedAt ? String(d.connectedAt) : null,
    updatedAt: d.updatedAt ? String(d.updatedAt) : null
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

/**
 * Checks if a specific user (by ID) has connected Google Calendar and opted in
 */
export async function checkUserGoogleCalendarPermission(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from('google_calendar_connections')
      .select('status, opted_in')
      .eq('owner_id', userId)
      .maybeSingle();

    if (error || !data) return false;
    return data.status === 'connected' && Boolean(data.opted_in);
  } catch {
    return false;
  }
}

/**
 * Sends a Google Calendar write permission request email to an assignee
 */
export async function requestGoogleCalendarPermission(
  assigneeId: string,
  groupName: string,
  senderName: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase.functions.invoke('send-task-email', {
      body: {
        assigneeId,
        groupName,
        senderName,
        type: 'calendar_permission_request',
      },
    });

    if (error) throw error;
    return { success: true, message: 'Permission request sent successfully.' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
}

