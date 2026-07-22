import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsModal } from './SettingsModal';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'user-123', full_name: 'Test Owner', email: 'owner@example.com' },
    updateProfileName: vi.fn()
  })
}));

vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'vi' })
}));

vi.mock('@/context/TeamContext', () => ({
  useTeam: () => ({
    groups: [],
    currentGroupIndex: 0,
    members: [],
    loadPersistedState: vi.fn(),
    deleteProject: vi.fn()
  })
}));

vi.mock('@/context/EntitlementContext', () => ({
  useEntitlements: () => ({
    plan: 'pro_group',
    expiresAt: null,
    isActive: true,
    loading: false,
    refreshEntitlements: vi.fn()
  })
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    functions: { invoke: vi.fn().mockResolvedValue({ data: { status: 'disconnected' } }) },
    rpc: vi.fn().mockResolvedValue({ data: [] })
  }
}));

describe('SettingsModal with Google Calendar integration', () => {
  it('renders SettingsModal and includes GoogleCalendarConnectionCard', async () => {
    render(<SettingsModal open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText(/Cấu hình Tài khoản|Account Settings/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('google-calendar-connection-card')).toBeInTheDocument();
    });
  });
});
