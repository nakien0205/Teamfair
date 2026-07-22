import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/context/LanguageContext";

const { consumeRecoveryEventProof, updateUser, getUser, onAuthStateChange } = vi.hoisted(() => ({
  consumeRecoveryEventProof: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  isSupabaseConfigured: true,
  consumeRecoveryEventProof,
  supabase: { auth: { updateUser, getUser, onAuthStateChange } },
}));

import ResetPassword from "./ResetPassword";

let authCallback: ((event: string, session: { user?: { id: string } } | null) => void) | undefined;

function renderResetPage() {
  window.history.replaceState({}, "", "/reset-password#type=recovery");
  return render(<LanguageProvider><MemoryRouter><ResetPassword /></MemoryRouter></LanguageProvider>);
}

describe("ResetPassword", () => {
  beforeEach(() => {
    updateUser.mockReset();
    getUser.mockReset();
    consumeRecoveryEventProof.mockReset();
    authCallback = undefined;
    onAuthStateChange.mockImplementation((callback) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
  });

  it("does not update an ordinary signed-in session without RecoveryProof", async () => {
    renderResetPage();
    act(() => authCallback?.("SIGNED_IN", { user: { id: "ordinary-user" } }));

    expect(screen.queryByRole("button", { name: "Cập nhật mật khẩu" })).not.toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates password only after an implicit PASSWORD_RECOVERY proof", async () => {
    updateUser.mockResolvedValueOnce({ error: null });
    getUser.mockResolvedValueOnce({ data: { user: { id: "recovery-user" } }, error: null });
    consumeRecoveryEventProof.mockReturnValueOnce(null).mockReturnValueOnce({ userId: "recovery-user" });
    renderResetPage();
    act(() => authCallback?.("PASSWORD_RECOVERY", { user: { id: "recovery-user" } }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Cập nhật mật khẩu" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "correct-horse" } });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu"), { target: { value: "correct-horse" } });
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật mật khẩu" }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "correct-horse" }));
  });

  it("keeps the initially captured recovery signal when Supabase consumes the URL before the recovery callback", async () => {
    consumeRecoveryEventProof.mockReturnValueOnce(null).mockReturnValueOnce({ userId: "recovery-user" });
    renderResetPage();
    window.history.replaceState({}, "", "/reset-password");

    act(() => authCallback?.("PASSWORD_RECOVERY", { user: { id: "recovery-user" } }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Cập nhật mật khẩu" })).toBeInTheDocument());
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("accepts a bridge-captured PASSWORD_RECOVERY proof that occurred before page subscription", async () => {
    consumeRecoveryEventProof.mockReturnValueOnce({ userId: "recovery-user" });
    renderResetPage();
    window.history.replaceState({}, "", "/reset-password");

    act(() => authCallback?.("INITIAL_SESSION", { user: { id: "recovery-user" } }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Cập nhật mật khẩu" })).toBeInTheDocument());
  });

  it("does not update a password after the authenticated account changes", async () => {
    consumeRecoveryEventProof.mockReturnValueOnce(null).mockReturnValueOnce({ userId: "recovery-user" });
    renderResetPage();
    act(() => authCallback?.("PASSWORD_RECOVERY", { user: { id: "recovery-user" } }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cập nhật mật khẩu" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "correct-horse" } });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu"), { target: { value: "correct-horse" } });
    getUser.mockResolvedValueOnce({ data: { user: { id: "switched-user" } }, error: null });

    fireEvent.click(screen.getByRole("button", { name: "Cập nhật mật khẩu" }));

    await waitFor(() => expect(screen.getByText(/Mật khẩu của bạn chưa thay đổi/i)).toBeInTheDocument());
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects an ordinary INITIAL_SESSION even when the URL has a spoofed recovery type", async () => {
    renderResetPage();
    act(() => authCallback?.("INITIAL_SESSION", { user: { id: "ordinary-user" } }));

    expect(screen.queryByRole("button", { name: "Cập nhật mật khẩu" })).not.toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("displays the 5-minute session timer and allows toggling password visibility", async () => {
    consumeRecoveryEventProof.mockReturnValueOnce({ userId: "recovery-user" });
    renderResetPage();
    act(() => authCallback?.("INITIAL_SESSION", { user: { id: "recovery-user" } }));

    await waitFor(() => expect(screen.getByText(/Phiên hết hạn sau:/i)).toBeInTheDocument());
    expect(screen.getByText("5:00")).toBeInTheDocument();

    const newPasswordInput = screen.getByLabelText("Mật khẩu mới");
    expect(newPasswordInput).toHaveAttribute("type", "password");

    const revealButtons = screen.getAllByRole("button", { name: /Hiện mật khẩu/i });
    expect(revealButtons).toHaveLength(2);

    fireEvent.click(revealButtons[0]);
    expect(newPasswordInput).toHaveAttribute("type", "text");

    const hideButtons = screen.getAllByRole("button", { name: /Ẩn mật khẩu/i });
    expect(hideButtons.length).toBeGreaterThan(0);
  });
});

