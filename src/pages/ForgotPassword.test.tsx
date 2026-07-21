import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/context/LanguageContext";

const { resetPasswordForEmail } = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn() }));

vi.mock("@/lib/supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { resetPasswordForEmail } },
}));

import ForgotPassword from "./ForgotPassword";

describe("ForgotPassword", () => {
  beforeEach(() => resetPasswordForEmail.mockReset());

  it("shows one generic completion state even when the provider rejects the request", async () => {
    resetPasswordForEmail.mockRejectedValueOnce(new Error("provider unavailable"));
    render(<LanguageProvider><MemoryRouter><ForgotPassword /></MemoryRouter></LanguageProvider>);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "student@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi liên kết đặt lại" }));

    await waitFor(() => expect(screen.getByText(/Nếu tài khoản phù hợp tồn tại/i)).toBeInTheDocument());
    expect(resetPasswordForEmail).toHaveBeenCalledWith("student@example.com", {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    expect(screen.queryByText("provider unavailable")).not.toBeInTheDocument();
  });
});
