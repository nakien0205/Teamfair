import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GoogleCalendarConnectionCard } from './GoogleCalendarConnectionCard';
import * as connectionApi from '@/lib/googleCalendarConnection';

vi.mock('@/lib/googleCalendarConnection', async (importOriginal) => {
  const actual = await importOriginal<typeof connectionApi>();
  return {
    ...actual,
    fetchGoogleCalendarConnectionStatus: vi.fn(),
    startGoogleCalendarAuthorization: vi.fn(),
    setGoogleCalendarOptIn: vi.fn(),
    disconnectGoogleCalendar: vi.fn()
  };
});

describe('GoogleCalendarConnectionCard component', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders upgrade guidance for free users', async () => {
    vi.mocked(connectionApi.fetchGoogleCalendarConnectionStatus).mockResolvedValue({
      status: 'disconnected',
      optedIn: false,
      grantedScopes: [],
      connectionGeneration: 0,
      attentionCode: null,
      connectedAt: null,
      updatedAt: null
    });

    render(<GoogleCalendarConnectionCard userPlan="free" />);

    await waitFor(() => {
      expect(screen.getByText(/Google Calendar sync requires a Pro Group or Pro Max plan/i)).toBeInTheDocument();
    });
  });

  it('renders connect button for eligible pro_group user when disconnected', async () => {
    vi.mocked(connectionApi.fetchGoogleCalendarConnectionStatus).mockResolvedValue({
      status: 'disconnected',
      optedIn: false,
      grantedScopes: [],
      connectionGeneration: 0,
      attentionCode: null,
      connectedAt: null,
      updatedAt: null
    });

    render(<GoogleCalendarConnectionCard userPlan="pro_group" />);

    await waitFor(() => {
      expect(screen.getByText('Connect Account')).toBeInTheDocument();
    });
  });

  it('renders connected state and handles opt-in toggle', async () => {
    vi.mocked(connectionApi.fetchGoogleCalendarConnectionStatus).mockResolvedValue({
      status: 'connected',
      optedIn: false,
      grantedScopes: ['openid'],
      connectionGeneration: 1,
      attentionCode: null,
      connectedAt: '2026-07-22T20:00:00Z',
      updatedAt: '2026-07-22T20:00:00Z'
    });

    vi.mocked(connectionApi.setGoogleCalendarOptIn).mockResolvedValue({
      status: 'connected',
      optedIn: true,
      grantedScopes: ['openid'],
      connectionGeneration: 1,
      attentionCode: null,
      connectedAt: '2026-07-22T20:00:00Z',
      updatedAt: '2026-07-22T20:00:00Z'
    });

    render(<GoogleCalendarConnectionCard userPlan="pro_max" />);

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    const toggle = screen.getByRole('checkbox', { name: /Toggle task sync/i });
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(connectionApi.setGoogleCalendarOptIn).toHaveBeenCalledWith(true);
    });
  });

  it('handles disconnect action cleanly', async () => {
    vi.mocked(connectionApi.fetchGoogleCalendarConnectionStatus).mockResolvedValue({
      status: 'connected',
      optedIn: true,
      grantedScopes: ['openid'],
      connectionGeneration: 1,
      attentionCode: null,
      connectedAt: '2026-07-22T20:00:00Z',
      updatedAt: '2026-07-22T20:00:00Z'
    });

    vi.mocked(connectionApi.disconnectGoogleCalendar).mockResolvedValue({
      status: 'disconnected',
      optedIn: false,
      grantedScopes: [],
      connectionGeneration: 2,
      attentionCode: null,
      connectedAt: null,
      updatedAt: '2026-07-22T20:05:00Z'
    });

    render(<GoogleCalendarConnectionCard userPlan="pro_group" />);

    await waitFor(() => {
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Disconnect'));

    await waitFor(() => {
      expect(connectionApi.disconnectGoogleCalendar).toHaveBeenCalled();
    });
  });
});
