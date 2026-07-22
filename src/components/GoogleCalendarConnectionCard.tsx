import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, AlertCircle, RefreshCw, LogOut, ShieldAlert, Sparkles } from 'lucide-react';
import {
  GoogleCalendarConnectionView,
  fetchGoogleCalendarConnectionStatus,
  startGoogleCalendarAuthorization,
  setGoogleCalendarOptIn,
  disconnectGoogleCalendar
} from '@/lib/googleCalendarConnection';
import { hasProGroupFeatures, BillingPlan } from '@/lib/billing';

interface GoogleCalendarConnectionCardProps {
  userPlan?: BillingPlan;
  onUpgradeClick?: () => void;
}

export const GoogleCalendarConnectionCard: React.FC<GoogleCalendarConnectionCardProps> = ({
  userPlan = 'free',
  onUpgradeClick
}) => {
  const [connection, setConnection] = useState<GoogleCalendarConnectionView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionPending, setActionPending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isEligible = hasProGroupFeatures(userPlan);

  useEffect(() => {
    let isMounted = true;
    async function loadStatus() {
      try {
        setLoading(true);
        const data = await fetchGoogleCalendarConnectionStatus();
        if (isMounted) setConnection(data);
      } catch (err) {
        if (isMounted) setErrorMsg('Unable to load connection status');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadStatus();
    return () => { isMounted = false; };
  }, []);

  const handleConnect = async () => {
    if (!isEligible || actionPending) return;
    try {
      setActionPending(true);
      setErrorMsg(null);
      const authUrl = await startGoogleCalendarAuthorization();
      window.location.href = authUrl;
    } catch (err: any) {
      setErrorMsg(err.message || 'Authorization failed');
      setActionPending(false);
    }
  };

  const handleToggleOptIn = async (enabled: boolean) => {
    if (actionPending) return;
    try {
      setActionPending(true);
      setErrorMsg(null);
      const updated = await setGoogleCalendarOptIn(enabled);
      setConnection(updated);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update sync setting');
    } finally {
      setActionPending(false);
    }
  };

  const handleDisconnect = async () => {
    if (actionPending) return;
    try {
      setActionPending(true);
      setErrorMsg(null);
      const updated = await disconnectGoogleCalendar();
      setConnection(updated);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to disconnect');
    } finally {
      setActionPending(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 border rounded-xl bg-card text-card-foreground shadow-sm flex items-center justify-between" data-testid="google-calendar-connection-card">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-muted-foreground animate-pulse" />
          <span className="text-sm font-medium">Checking Google Calendar connection...</span>
        </div>
      </div>
    );
  }

  const isConnected = connection?.status === 'connected';
  const isDisconnecting = connection?.status === 'disconnecting';
  const isAttention = connection?.status === 'attention_needed';

  return (
    <div className="p-5 border rounded-xl bg-card text-card-foreground shadow-sm space-y-4" data-testid="google-calendar-connection-card">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Google Calendar Integration</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sync tasks with your Google Calendar. OAuth consent is separate from Teamfair sign-in.
            </p>
          </div>
        </div>

        {isConnected && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Connected
          </span>
        )}
      </div>

      {!isEligible && (
        <div className="p-3 text-xs rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Google Calendar sync requires a Pro Group or Pro Max plan.</span>
          </div>
          {onUpgradeClick && (
            <button
              onClick={onUpgradeClick}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 transition"
            >
              Upgrade
            </button>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 text-xs rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isEligible && (
        <div className="pt-2 border-t flex flex-col gap-3">
          {!isConnected && !isDisconnecting && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Authorize Teamfair to manage events on your Google account.
              </span>
              <button
                onClick={handleConnect}
                disabled={actionPending}
                aria-label="Connect Google Calendar"
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition flex items-center gap-1.5"
              >

                {actionPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>Connect Account</>
                )}
              </button>
            </div>
          )}

          {isConnected && (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <div>
                  <div className="text-xs font-medium">Automatic Task Sync</div>
                  <div className="text-[11px] text-muted-foreground">
                    Allow Teamfair to write scheduled tasks to your calendar
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(connection?.optedIn)}
                    onChange={(e) => handleToggleOptIn(e.target.checked)}
                    disabled={actionPending}
                    aria-label="Toggle task sync"
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleDisconnect}
                  disabled={actionPending}
                  aria-label="Disconnect Google Calendar"
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </div>
            </>
          )}

          {isDisconnecting && (
            <div className="p-3 text-xs rounded-lg bg-muted flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Disconnecting Google Calendar and revoking credentials...</span>
            </div>
          )}

          {isAttention && (
            <div className="p-3 text-xs rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Re-authentication required: {connection?.attentionCode || 'Reconnect required'}</span>
              </div>
              <button
                onClick={handleConnect}
                disabled={actionPending}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
              >
                Reconnect
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
