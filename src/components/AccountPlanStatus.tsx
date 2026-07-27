import { ChevronRight, Crown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { Language } from "@/context/LanguageContext";
import type { BillingPlan } from "@/lib/billing";

type AccountPlanStatusProps = {
  plan: BillingPlan;
  loading: boolean;
  error: boolean;
  expiresAt: string | null;
  language: Language;
  onOpenPlans: () => void;
  onRetry: () => void;
};

const COPY = {
  vi: {
    current: "Gói hiện tại",
    free: "Miễn phí",
    viewPlans: "Xem các gói Pro",
    loading: "Đang tải gói…",
    unavailable: "Không tải được gói",
    retry: "Thử lại",
    activeUntil: "Có hiệu lực đến",
  },
  en: {
    current: "Current plan",
    free: "Free",
    viewPlans: "View Pro plans",
    loading: "Loading plan…",
    unavailable: "Plan unavailable",
    retry: "Try again",
    activeUntil: "Active until",
  },
} as const;

function getExpiryLabel(expiresAt: string | null, language: Language): string | undefined {
  if (!expiresAt) return undefined;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return undefined;

  const copy = COPY[language];
  const formatted = new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  return `${copy.activeUntil} ${formatted}`;
}

export function AccountPlanStatus({
  plan,
  loading,
  error,
  expiresAt,
  language,
  onOpenPlans,
  onRetry,
}: AccountPlanStatusProps) {
  const copy = COPY[language];

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white/75 px-3 text-slate-600"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span className="text-xs font-semibold sm:text-sm">{copy.loading}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div aria-live="polite">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-2.5 text-left text-rose-900 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 sm:px-3"
          aria-label={`${copy.unavailable}. ${copy.retry}`}
        >
          <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex flex-col leading-tight">
            <span className="hidden text-[10px] font-medium text-rose-700 sm:block">{copy.unavailable}</span>
            <span className="text-xs font-semibold sm:text-sm">{copy.retry}</span>
          </span>
        </button>
      </div>
    );
  }

  const planLabel = plan === "free" ? copy.free : plan === "pro_group" ? "Pro Group" : "Pro Max";
  const expiryLabel = getExpiryLabel(expiresAt, language);

  if (plan === "pro_max") {
    return (
      <div
        role="status"
        aria-live="polite"
        title={expiryLabel}
        aria-label={`${copy.current}: ${planLabel}${expiryLabel ? `. ${expiryLabel}` : ""}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-2.5 text-slate-50 shadow-sm sm:px-3"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10">
          <Crown className="h-4 w-4 text-amber-300" aria-hidden="true" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="hidden text-[10px] font-medium text-slate-300 sm:block">{copy.current}</span>
          <span className="text-xs font-semibold sm:text-sm">{planLabel}</span>
        </span>
      </div>
    );
  }

  const isProGroup = plan === "pro_group";
  return (
    <div aria-live="polite">
      <button
        type="button"
        onClick={onOpenPlans}
        title={expiryLabel}
        aria-label={`${copy.current}: ${planLabel}. ${copy.viewPlans}${expiryLabel ? `. ${expiryLabel}` : ""}`}
        className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:px-3 ${
          isProGroup
            ? "border-amber-200 bg-amber-50/90 text-amber-950 hover:bg-amber-100 focus-visible:ring-amber-500"
            : "border-slate-200 bg-white/80 text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-500"
        }`}
      >
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
            isProGroup ? "bg-amber-200/70 text-amber-900" : "bg-slate-100 text-slate-600"
          }`}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="hidden text-[10px] font-medium opacity-70 sm:block">{copy.current}</span>
          <span className="text-xs font-semibold sm:text-sm">
            {planLabel}
            <span className="hidden font-medium opacity-70 lg:inline"> · {copy.viewPlans}</span>
          </span>
        </span>
        <ChevronRight className="hidden h-4 w-4 opacity-60 sm:block" aria-hidden="true" />
      </button>
    </div>
  );
}
