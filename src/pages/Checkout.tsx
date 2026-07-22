import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, Star, X } from "lucide-react";
import Swal from "sweetalert2";
import * as Sentry from "@sentry/react";
import { PRO_GROUP_PRICE_VND, PRO_MAX_PRICE_VND, type BillingPlan } from "@/lib/billing";
import { useAuth } from "@/context/AuthContext";
import { useEntitlements } from "@/context/EntitlementContext";
import { useLanguage, type Language } from "@/context/LanguageContext";
import LanguageSwitcherButton from "@/components/LanguageSwitcherButton";

type PricingPlan = Exclude<BillingPlan, "free"> | "free";
type LocalizedText = Record<Language, string>;

type Plan = {
  id: PricingPlan;
  name: LocalizedText;
  price: number;
  cycle: LocalizedText;
  popular?: boolean;
  features: LocalizedText[];
};

type CheckoutResponse =
  | { ok: true; data: { orderId: string; orderReference: string; amount: number; qrUrl: string } }
  | { ok: false; error?: { code?: string; message?: string } };

const COPY = {
  vi: {
    title: "Chọn gói dành cho bạn",
    subtitle: "Pro là quyền cá nhân. Thành viên khác trong cùng nhóm không tự nhận quyền Pro.",
    freeCycle: "mãi miễn phí",
    popular: "Phổ biến nhất",
    current: "Đang sử dụng",
    useFree: "Sử dụng miễn phí",
    payNow: "Thanh toán ngay",
    paymentError: "Không thể tạo đơn thanh toán. Vui lòng thử lại sau.",
    paymentSuccess: "Thanh toán thành công!",
    activated: (plan: string) => `Gói ${plan} đã được kích hoạt trong 30 ngày.`,
    close: "Đóng",
    qrTitle: "Quét mã thanh toán",
    packageLabel: "Gói:",
    amountLabel: "Số tiền:",
    transferLabel: "Nội dung CK:",
    waiting: "Đang đợi xác nhận thanh toán...",
    service: "dịch vụ",
  },
  en: {
    title: "Choose your plan",
    subtitle: "Pro access belongs to each account. Other members in the same group do not inherit it.",
    freeCycle: "forever free",
    popular: "Most popular",
    current: "Current plan",
    useFree: "Use for free",
    payNow: "Pay now",
    paymentError: "Unable to create payment order. Please try again later.",
    paymentSuccess: "Payment successful!",
    activated: (plan: string) => `${plan} has been activated for 30 days.`,
    close: "Close",
    qrTitle: "Scan to pay",
    packageLabel: "Plan:",
    amountLabel: "Amount:",
    transferLabel: "Transfer note:",
    waiting: "Waiting for payment confirmation...",
    service: "service",
  },
} as const;

const PLANS: Plan[] = [
  {
    id: "free",
    name: { vi: "Miễn phí", en: "Free" },
    price: 0,
    cycle: { vi: "mãi miễn phí", en: "forever free" },
    features: [
      { vi: "1 nhóm sở hữu, tối đa 6 thành viên", en: "1 owned group, up to 6 members" },
      { vi: "Tối đa 20 task/nhóm", en: "Up to 20 tasks/group" },
      { vi: "200 MB storage/nhóm", en: "200 MB storage/group" },
      { vi: "Task, deadline và calendar cơ bản", en: "Basic tasks, deadlines, and calendar" },
    ],
  },
  {
    id: "pro_group",
    name: { vi: "Pro Group", en: "Pro Group" },
    price: PRO_GROUP_PRICE_VND,
    cycle: { vi: "/người/tháng", en: "/user/month" },
    popular: true,
    features: [
      { vi: "Dành riêng cho tài khoản đã trả phí", en: "For paid accounts only" },
      { vi: "Nhóm bạn sở hữu: tối đa 30 thành viên", en: "Owned groups: up to 30 members" },
      { vi: "Task không giới hạn, storage 5 GB", en: "Unlimited tasks, 5 GB storage" },
      { vi: "Analytics, export và AI nâng cao", en: "Advanced analytics, export, and AI" },
    ],
  },
  {
    id: "pro_max",
    name: { vi: "Pro Max", en: "Pro Max" },
    price: PRO_MAX_PRICE_VND,
    cycle: { vi: "/người/tháng", en: "/user/month" },
    features: [
      { vi: "Bao gồm toàn bộ Pro Group", en: "Includes all Pro Group features" },
      { vi: "Tạo nhóm không giới hạn", en: "Unlimited group creation" },
      { vi: "Dashboard đa project", en: "Multi-project dashboard" },
      { vi: "Storage 20 GB/nhóm", en: "20 GB storage/group" },
    ],
  },
];

const currency = (value: number, language: Language) => {
  const formatted = new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US").format(value);
  return language === "vi" ? `${formatted}đ` : `${formatted} VND`;
};

async function readPaymentApiContext(error: unknown): Promise<Record<string, unknown> | null> {
  const response = (error as { context?: unknown } | null)?.context;
  if (!(response instanceof Response)) return null;

  let responseCopy: Response;
  try {
    responseCopy = response.clone();
  } catch {
    return { status: response.status, statusText: response.statusText };
  }

  const body = await responseCopy.json().catch(() => null);
  const apiError = body && typeof body === "object" && "error" in body
    ? (body as { error?: { code?: unknown; message?: unknown } }).error
    : undefined;

  return {
    status: response.status,
    statusText: response.statusText,
    code: typeof apiError?.code === "string" ? apiError.code : undefined,
    message: typeof apiError?.message === "string" ? apiError.message : undefined,
  };
}

export default function Checkout() {
  const [loadingPlan, setLoadingPlan] = useState<PricingPlan | null>(null);
  const [currentOrder, setCurrentOrder] = useState<CheckoutResponse["data"] | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan: activePlan, refreshEntitlements } = useEntitlements();
  const { language } = useLanguage();
  const copy = COPY[language];

  useEffect(() => {
    if (!currentOrder) return;
    let completed = false;
    const checkOrder = async () => {
      const { data, error: statusError } = await supabase
        .from("orders")
        .select("status,plan_id")
        .eq("id", currentOrder.orderId)
        .maybeSingle();
      if (statusError || !data || data.status !== "PAID" || completed) return;
      completed = true;
      await refreshEntitlements();
      setShowQrModal(false);
      const matchedPlan = PLANS.find((item) => item.id === data.plan_id);
      await Swal.fire({
        title: copy.paymentSuccess,
        text: copy.activated(matchedPlan?.name[language] || copy.service),
        icon: "success",
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
      });
      navigate("/student/dashboard");
    };
    void checkOrder();
    const timer = window.setInterval(() => void checkOrder(), 3000);
    return () => window.clearInterval(timer);
  }, [copy, currentOrder, language, navigate, refreshEntitlements]);

  const handlePayment = async (plan: Plan) => {
    if (plan.id === "free") {
      navigate(user ? "/student/dashboard" : "/login");
      return;
    }
    if (!user) {
      navigate("/login");
      return;
    }

    setLoadingPlan(plan.id);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke<CheckoutResponse>("billing-api", {
        body: { planId: plan.id },
      });
      if (invokeError) throw invokeError;
      if (!data?.ok) throw new Error(data?.error?.message || "Payment API returned an invalid response.");
      setCurrentOrder(data.data);
      setSelectedPlan(plan);
      setShowQrModal(true);
    } catch (paymentError) {
      const apiContext = await readPaymentApiContext(paymentError);
      console.error("Payment order creation failed:", paymentError, apiContext);
      Sentry.withScope((scope) => {
        scope.setTag("feature", "billing");
        scope.setTag("billing_plan", plan.id);
        scope.setContext("payment_request", { planId: plan.id, amountVnd: plan.price });
        if (apiContext) scope.setContext("payment_api", apiContext);
        Sentry.captureException(paymentError instanceof Error ? paymentError : new Error(String(paymentError)));
      });
      setError(copy.paymentError);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <LanguageSwitcherButton className="absolute right-4 top-4" />
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">{copy.title}</h1>
          <p className="text-lg text-gray-600">{copy.subtitle}</p>
        </div>

        <div className="mb-12 grid gap-8 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = activePlan === plan.id;
            return (
              <div key={plan.id} className={`relative transition-transform duration-300 ${plan.popular ? "md:scale-105" : ""}`}>
                {plan.popular && <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2"><span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1 text-sm font-semibold text-white"><Star className="h-4 w-4 fill-current" />{copy.popular}</span></div>}
                <Card className={`flex h-full flex-col ${plan.popular ? "border-2 border-amber-500 shadow-lg" : "border-gray-200"}`}>
                  <CardHeader>
                    <CardTitle className="text-2xl">{plan.name[language]}</CardTitle>
                    <div className="mt-4"><div className="text-4xl font-bold text-gray-900">{currency(plan.price, language)}</div><div className="mt-2 text-sm text-gray-600">{plan.price === 0 ? copy.freeCycle : plan.cycle[language]}</div></div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    <ul className="mb-6 flex-1 space-y-3">{plan.features.map((feature) => <li key={feature[language]} className="flex gap-3 text-sm"><Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" /><span className="text-gray-700">{feature[language]}</span></li>)}</ul>
                    <Button onClick={() => void handlePayment(plan)} disabled={loadingPlan !== null || isCurrent} className={`w-full ${plan.popular ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600" : ""}`} size="lg">
                      {loadingPlan === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isCurrent ? copy.current : plan.id === "free" ? copy.useFree : copy.payNow}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {error && <div className="mx-auto mb-6 max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">{error}</div>}

        {showQrModal && selectedPlan && currentOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
              <button onClick={() => setShowQrModal(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600" aria-label={copy.close}><X className="h-6 w-6" /></button>
              <h3 className="mb-2 text-xl font-bold text-gray-900">{copy.qrTitle}</h3>
              <p className="mb-4 text-sm text-gray-500">{copy.packageLabel} <span className="font-semibold text-gray-800">{selectedPlan.name[language]}</span></p>
              <div className="mb-4 inline-block rounded-xl border border-gray-100 bg-slate-50 p-4"><img src={currentOrder.qrUrl} alt="VietQR payment" className="mx-auto h-64 w-64 object-contain" /></div>
              <div className="mb-4 space-y-1 rounded-xl border border-blue-100 bg-blue-50 p-3 text-left text-xs text-blue-800"><p><strong>{copy.amountLabel}</strong> {currency(currentOrder.amount, language)}</p><p><strong>{copy.transferLabel}</strong> <span className="rounded bg-red-50 px-1 font-bold text-red-600">{currentOrder.orderReference}</span></p></div>
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-amber-600"><Loader2 className="h-4 w-4 animate-spin" />{copy.waiting}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
