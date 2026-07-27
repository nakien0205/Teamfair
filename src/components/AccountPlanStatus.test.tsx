import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountPlanStatus } from "@/components/AccountPlanStatus";

const baseProps = {
  plan: "free" as const,
  loading: false,
  error: false,
  expiresAt: null,
  language: "en" as const,
  onOpenPlans: vi.fn(),
  onRetry: vi.fn(),
};

describe("AccountPlanStatus", () => {
  it("shows a non-purchasable loading state", () => {
    render(<AccountPlanStatus {...baseProps} loading />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading plan…");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a retry action instead of treating lookup failure as Free", () => {
    const onRetry = vi.fn();
    render(<AccountPlanStatus {...baseProps} error onRetry={onRetry} />);

    expect(screen.getByText("Plan unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Plan unavailable. Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByText("Free")).not.toBeInTheDocument();
  });

  it("labels Free and opens plan choices", () => {
    const onOpenPlans = vi.fn();
    render(<AccountPlanStatus {...baseProps} onOpenPlans={onOpenPlans} />);

    expect(screen.getByText("Current plan")).toBeInTheDocument();
    expect(screen.getByText("Free", { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Current plan: Free. View Pro plans/i }));
    expect(onOpenPlans).toHaveBeenCalledOnce();
  });

  it("keeps the Pro Group tier explicit in Vietnamese", () => {
    render(
      <AccountPlanStatus
        {...baseProps}
        plan="pro_group"
        language="vi"
        expiresAt="2026-08-26T00:00:00.000Z"
      />,
    );

    expect(screen.getByText("Gói hiện tại")).toBeInTheDocument();
    expect(screen.getByText("Pro Group", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gói hiện tại: Pro Group. Xem các gói Pro/i })).toBeInTheDocument();
  });

  it("renders Pro Max as status text with no subscription action", () => {
    render(<AccountPlanStatus {...baseProps} plan="pro_max" />);

    expect(screen.getByRole("status", { name: "Current plan: Pro Max" })).toBeInTheDocument();
    expect(screen.getByText("Pro Max")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/subscribe premium/i)).not.toBeInTheDocument();
  });
});

describe("DashboardHeader plan control contract", () => {
  it("uses AccountPlanStatus and removes the generic premium CTA", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/DashboardHeader.tsx"), "utf8");

    expect(source).toContain("<AccountPlanStatus");
    expect(source).not.toMatch(/Subscribe Premium|Đăng ký Premium/);
  });
});
