import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  Check,
  Star,
  X,
  Gift,
  Users,
  Award,
  Sparkles,
  GraduationCap,
  UserCheck,
  Copy,
  User as UserIcon,
  ShieldCheck,
  CheckCircle2,
  Clock,
  QrCode,
  ArrowLeft,
  Zap,
} from "lucide-react";
import Swal from "sweetalert2";
import * as Sentry from "@sentry/react";
import { useAuth } from "@/context/AuthContext";
import { useEntitlements } from "@/context/EntitlementContext";
import { useLanguage, type Language } from "@/context/LanguageContext";
import LanguageSwitcherButton from "@/components/LanguageSwitcherButton";

export type Role = "student" | "lecturer";

export type ComboPlan = {
  id: string;
  months: number;
  label: Record<Language, string>;
  effectivePricePerMonth: number;
  totalPrice: number;
  discountPercent: number;
  popular?: boolean;
};

type CheckoutResponse =
  | { ok: true; data: { orderId: string; orderReference: string; amount: number; qrUrl: string } }
  | { ok: false; error?: { code?: string; message?: string } };

type UserProfileInfo = {
  fullName: string;
  email: string;
  role: Role;
};

type ActiveSubscription = {
  plan_id: string;
  expires_at: string;
};

type FreeFeatureItem = {
  text: string;
  included: boolean;
};

// Bảng giá Combo Sinh viên
const STUDENT_COMBOS: ComboPlan[] = [
  { id: "student_1m", months: 1, label: { vi: "1 Tháng", en: "1 Month" }, effectivePricePerMonth: 79000, totalPrice: 79000, discountPercent: 0 },
  { id: "student_3m", months: 3, label: { vi: "3 Tháng", en: "3 Months" }, effectivePricePerMonth: 71100, totalPrice: 213300, discountPercent: 10 },
  { id: "student_6m", months: 6, label: { vi: "6 Tháng", en: "6 Months" }, effectivePricePerMonth: 64780, totalPrice: 388680, discountPercent: 18, popular: true },
  { id: "student_12m", months: 12, label: { vi: "12 Tháng", en: "12 Months" }, effectivePricePerMonth: 59250, totalPrice: 711000, discountPercent: 25 },
];

// Bảng giá Combo Giảng viên
const LECTURER_COMBOS: ComboPlan[] = [
  { id: "lecturer_1m", months: 1, label: { vi: "1 Tháng", en: "1 Month" }, effectivePricePerMonth: 450000, totalPrice: 450000, discountPercent: 0 },
  { id: "lecturer_3m", months: 3, label: { vi: "3 Tháng", en: "3 Months" }, effectivePricePerMonth: 405000, totalPrice: 1215000, discountPercent: 10 },
  { id: "lecturer_6m", months: 6, label: { vi: "6 Tháng", en: "6 Months" }, effectivePricePerMonth: 369000, totalPrice: 2214000, discountPercent: 18, popular: true },
  { id: "lecturer_12m", months: 12, label: { vi: "12 Tháng", en: "12 Months" }, effectivePricePerMonth: 337500, totalPrice: 4050000, discountPercent: 25 },
];

// Quyền lợi gói Free phân theo vai trò
const FREE_FEATURES_BY_ROLE: Record<Role, Record<Language, FreeFeatureItem[]>> = {
  student: {
    vi: [
      { text: "1 nhóm sở hữu, tối đa 6 thành viên", included: true },
      { text: "Tối đa 20 task/nhóm", included: true },
      { text: "200 MB storage/nhóm", included: true },
      { text: "Task, deadline và calendar cơ bản", included: true },
    ],
    en: [
      { text: "1 owned group, max 6 members", included: true },
      { text: "Max 20 tasks per group", included: true },
      { text: "200 MB storage per group", included: true },
      { text: "Basic task, deadline & calendar", included: true },
    ],
  },
  lecturer: {
    vi: [
      { text: "Xem hoạt động của 2 lớp/nhóm", included: true },
      { text: "Đánh giá teamwork thủ công cơ bản", included: true },
      { text: "Xem timeline & tiến độ nhóm", included: true },
      { text: "Chấm điểm tự động theo tiêu chí", included: false },
      { text: "Xuất bảng điểm Excel/PDF", included: false },
      { text: "AI phân tích đóng góp", included: false },
    ],
    en: [
      { text: "View activity of 2 classes/groups", included: true },
      { text: "Basic manual teamwork evaluation", included: true },
      { text: "View team timeline & progress", included: true },
      { text: "Auto-grading based on criteria", included: false },
      { text: "Export gradebook to Excel/PDF", included: false },
      { text: "AI contribution analysis", included: false },
    ],
  },
};

// Quyền lợi chi tiết Gói Pro
const FEATURES_BY_ROLE: Record<Role, Record<Language, string[]>> = {
  student: {
    vi: [
      "Quyền truy cập Pro cá nhân trong thời hạn combo",
      "Tối đa 30 thành viên cho nhóm bạn sở hữu",
      "Dung lượng lưu trữ 5 GB / nhóm",
      "Tạo task không giới hạn, Analytics & Export AI",
    ],
    en: [
      "Personal Pro access for the selected duration",
      "Up to 30 members per owned group",
      "5 GB storage per group",
      "Unlimited tasks, Analytics & AI export",
    ],
  },
  lecturer: {
    vi: [
      "Toàn bộ tính năng cao cấp dành cho Giảng viên",
      "Tạo không giới hạn số lượng nhóm học tập / đồ án",
      "Dung lượng lưu trữ nâng cấp 20 GB / nhóm",
      "Dashboard quản lý đa project & xuất báo cáo chấm điểm",
    ],
    en: [
      "All premium features designed for Lecturers",
      "Unlimited project / learning group creation",
      "Upgraded 20 GB storage per group",
      "Multi-project dashboard & grading export tools",
    ],
  },
};

const COPY = {
  vi: {
    back: "Quay về",
    pageTitle: "Gói Dịch Vụ Premium",
    pageSubtitle: "Nâng tầm trải nghiệm học tập và làm việc nhóm với đầy đủ tính năng nâng cao",
    freeTitle: "Gói Free",
    freePrice: "0đ",
    freeSubtitle: "Miễn phí trọn đời cho cá nhân",
    lecturerFreeSubtitle: "Đủ dùng để GV thử nghiệm và thấy giá trị",
    freeUsing: "Đang sử dụng",
    freeDefault: "Gói Mặc Định",
    studentTitle: "Dành cho Sinh Viên",
    lecturerTitle: "Dành cho Giảng Viên",
    selectDuration: "Chọn gói thời hạn tiết kiệm:",
    popular: "Phổ biến nhất",
    payNow: "Nâng cấp ngay",
    usingPlan: "Gói hiện tại của bạn",
    currentPlanBadge: "Đang kích hoạt",
    monthSuffix: "/tháng",
    totalLabel: "Tổng thanh toán",
    paymentError: "Không thể tạo đơn thanh toán. Vui lòng thử lại sau.",
    paymentSuccess: "Thanh toán thành công!",
    activated: (months: number, totalDays: number) =>
      `Gói dịch vụ (${months} tháng - ${totalDays} ngày) đã được kích hoạt thành công!`,
    close: "Đóng",
    referralTitle: "Chương Trình Giới Thiệu (Referral → Voucher)",
    referralDesc: "Mời bạn bè cùng sử dụng để nhận ngay voucher giảm 20% cho lần thanh toán tiếp theo!",
    referrerReward: "Voucher nhận được:",
    studentVoucher: "14.244đ / lượt",
    lecturerVoucher: "81.135đ / lượt",
    saveBadge: (pct: number) => `Tiết kiệm ${pct}%`,
  },
  en: {
    back: "Back",
    pageTitle: "Premium Plans",
    pageSubtitle: "Upgrade your learning and team collaboration with advanced tools",
    freeTitle: "Free Plan",
    freePrice: "0 VND",
    freeSubtitle: "Free forever for individuals",
    lecturerFreeSubtitle: "Enough for Lecturers to test and see value",
    freeUsing: "Currently Active",
    freeDefault: "Default Plan",
    studentTitle: "For Students",
    lecturerTitle: "For Lecturers",
    selectDuration: "Select your saving combo plan:",
    popular: "Most Popular",
    payNow: "Upgrade Now",
    usingPlan: "Your Active Plan",
    currentPlanBadge: "Active Plan",
    monthSuffix: "/mo",
    totalLabel: "Total amount",
    paymentError: "Unable to create payment order. Please try again later.",
    paymentSuccess: "Payment successful!",
    activated: (months: number, totalDays: number) =>
      `Plan (${months} month(s) - ${totalDays} days) has been successfully activated!`,
    close: "Close",
    referralTitle: "Referral Program (Referral → Voucher)",
    referralDesc: "Invite friends or colleagues to earn a 20% discount voucher on your next renewal!",
    referrerReward: "Voucher earned:",
    studentVoucher: "14,244 VND / ref",
    lecturerVoucher: "81,135 VND / ref",
    saveBadge: (pct: number) => `Save ${pct}%`,
  },
} as const;

const currency = (value: number, language: Language) => {
  const formatted = new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US").format(value);
  return language === "vi" ? `${formatted}đ` : `${formatted} VND`;
};

const formatDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

function addCalendarMonths(startDate: Date, monthsToAdd: number): Date {
  const targetDate = new Date(startDate.getTime());
  const expectedMonth = (targetDate.getMonth() + monthsToAdd) % 12;

  targetDate.setMonth(targetDate.getMonth() + monthsToAdd);

  if (targetDate.getMonth() !== expectedMonth) {
    targetDate.setDate(0);
  }

  return targetDate;
}

export default function Checkout() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<CheckoutResponse["data"] | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ComboPlan | null>(null);
  
  const [selectedComboId, setSelectedComboId] = useState<string>("student_6m");
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  const [activeSub, setActiveSub] = useState<ActiveSubscription | null>(null);

  const [userInfo, setUserInfo] = useState<UserProfileInfo>({
    fullName: "",
    email: "",
    role: "student",
  });

  const navigate = useNavigate();
  const auth = useAuth() as unknown as { user?: any; profile?: any; role?: string };
  const user = auth?.user;
  const { refreshEntitlements } = useEntitlements();
  const { language } = useLanguage();
  const copy = COPY[language];

  // Hàm xử lý quay về
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(userInfo.role === "lecturer" ? "/lecturer/dashboard" : "/student/dashboard");
    }
  };

  // 1. Lấy thông tin tài khoản & gói cước từ DB
  useEffect(() => {
    async function fetchUserDataAndSubscription() {
      if (!user) {
        setIsRoleLoading(false);
        return;
      }

      try {
        const { data: userData } = await supabase
          .from("users")
          .select("full_name, role, email")
          .eq("id", user.id)
          .maybeSingle();

        const dbRole = (userData?.role || "").toString().toLowerCase().trim();
        const metaRole = (user.user_metadata?.role || user.app_metadata?.role || "").toString().toLowerCase().trim();
        const detectedRole: Role =
          dbRole === "lecturer" || dbRole === "teacher" || metaRole === "lecturer" ? "lecturer" : "student";

        const fullName = userData?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Khách hàng";
        const email = userData?.email || user.email || "";

        setUserInfo({
          fullName,
          email,
          role: detectedRole,
        });

        if (detectedRole === "lecturer") {
          setSelectedComboId("lecturer_6m");
        } else {
          setSelectedComboId("student_6m");
        }

        const { data: subData } = await supabase
          .from("user_subscriptions")
          .select("plan_id, expires_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (subData && subData.expires_at && new Date(subData.expires_at) > new Date()) {
          setActiveSub({
            plan_id: subData.plan_id,
            expires_at: subData.expires_at,
          });
        } else {
          setActiveSub(null);
        }
      } catch (err) {
        console.error("Lỗi đọc thông tin tài khoản hoặc gói cước:", err);
      } finally {
        setIsRoleLoading(false);
      }
    }

    void fetchUserDataAndSubscription();
  }, [user]);

  // 2. Polling đơn hàng
  useEffect(() => {
    if (!currentOrder || !selectedPlan) return;
    let completed = false;

    const checkOrder = async () => {
      const { data, error: statusError } = await supabase
        .from("orders")
        .select("status, plan_id")
        .eq("id", currentOrder.orderId)
        .maybeSingle();

      if (statusError || !data || data.status !== "PAID" || completed) return;
      completed = true;

      await refreshEntitlements();
      setShowQrModal(false);

      const allCombos = [...STUDENT_COMBOS, ...LECTURER_COMBOS];
      const matched = allCombos.find((c) => c.id === data.plan_id) || selectedPlan;

      const now = new Date();
      const calculatedEnd = addCalendarMonths(now, matched.months);
      const totalDays = Math.round((calculatedEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      setActiveSub({
        plan_id: matched.id,
        expires_at: calculatedEnd.toISOString(),
      });

      await Swal.fire({
        title: copy.paymentSuccess,
        text: copy.activated(matched.months, totalDays),
        icon: "success",
        timer: 3500,
        timerProgressBar: true,
        showConfirmButton: false,
      });

      navigate(userInfo.role === "lecturer" ? "/lecturer/dashboard" : "/student/dashboard");
    };

    void checkOrder();
    const timer = window.setInterval(() => void checkOrder(), 3000);
    return () => window.clearInterval(timer);
  }, [copy, currentOrder, selectedPlan, navigate, refreshEntitlements, userInfo.role]);

  // 3. Xử lý tạo đơn thanh toán
  const handlePayment = async (plan: ComboPlan) => {
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
      console.error("Payment order creation failed:", paymentError);
      Sentry.captureException(paymentError);
      setError(copy.paymentError);
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleCopyRef = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const now = new Date();
  const monthsCount = selectedPlan?.months || 1;
  const endDate = addCalendarMonths(now, monthsCount);
  const totalDays = Math.round((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const startDateStr = formatDate(now);

  if (isRoleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium text-slate-600">Đang tải thông tin dịch vụ...</p>
        </div>
      </div>
    );
  }

  const isLecturer = userInfo.role === "lecturer";
  const activeComboList = isLecturer ? LECTURER_COMBOS : STUDENT_COMBOS;
  const currentProPlan = activeComboList.find((c) => c.id === selectedComboId) || activeComboList[2];
  const isProPlanActive = activeSub?.plan_id === currentProPlan.id;
  const isFreePlanActive = !activeSub;

  return (
    <div className="relative min-h-screen bg-slate-50/70 py-10 px-4 sm:px-6 lg:px-8">
      
      {/* THANH ĐIỀU HƯỚNG TRÊN CÙNG */}
      <div className="mx-auto max-w-6xl flex items-center justify-between mb-8">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBack}
          className="flex items-center gap-2 rounded-xl border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-100 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{copy.back}</span>
        </Button>

        <LanguageSwitcherButton />
      </div>

      <div className="mx-auto max-w-5xl">
        {/* HEADER TIÊU ĐỀ */}
        <div className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-100/80 px-4 py-1 text-xs font-bold text-indigo-800 border border-indigo-200/50">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            <span>
              {isLecturer ? "Tài khoản Giảng Viên" : "Tài khoản Sinh Viên"}
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 sm:text-4xl tracking-tight">
            {copy.pageTitle}
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-xl mx-auto">
            {copy.pageSubtitle}
          </p>
        </div>

        {/* BẢNG SO SÁNH GÓI DỊCH VỤ */}
        <div className="mb-12 grid gap-8 md:grid-cols-12 items-stretch">
          
          {/* CỘT 1: THẺ GÓI FREE (CHIẾM 5 CỘT) */}
          <div className="md:col-span-5 flex flex-col">
            <Card className="flex h-full flex-col justify-between border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden p-1">
              <CardHeader className="p-6 pb-4">
                <CardTitle className="text-2xl font-black tracking-tight text-slate-900">
                  {isLecturer ? "GV FREE" : "Gói Free"}
                </CardTitle>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900">{copy.freePrice}</span>
                  <span className="text-xs font-medium text-slate-500">/tháng</span>
                </div>

                <p className="mt-2 text-xs font-medium text-slate-500 leading-relaxed">
                  {isLecturer ? copy.lecturerFreeSubtitle : copy.freeSubtitle}
                </p>
              </CardHeader>

              <CardContent className="p-6 pt-2 flex flex-1 flex-col justify-between">
                <div className="border-t border-slate-100 pt-4 mb-6">
                  {/* Danh sách tính năng của Gói Free */}
                  <ul className="space-y-3.5 text-xs">
                    {FREE_FEATURES_BY_ROLE[userInfo.role][language].map((feature, i) => (
                      <li key={i} className={`flex items-start gap-2.5 ${feature.included ? "text-slate-800 font-medium" : "text-slate-400 opacity-70"}`}>
                        {feature.included ? (
                          <Check className="h-4 w-4 flex-shrink-0 text-emerald-600 mt-0.5 stroke-[2.5]" />
                        ) : (
                          <span className="h-4 w-4 flex-shrink-0 flex items-center justify-center mt-0.5">
                            <span className="h-2 w-2 rounded-full border border-slate-300" />
                          </span>
                        )}
                        <span className="leading-relaxed">{feature.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  disabled
                  className={`w-full font-bold py-5 text-xs transition-all rounded-xl shadow-none ${
                    isFreePlanActive
                      ? "bg-slate-100 text-slate-600 border border-slate-200 cursor-default"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {isFreePlanActive ? copy.freeUsing : copy.freeDefault}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* CỘT 2: THẺ GÓI PRO NỔI BẬT (CHIẾM 7 CỘT) */}
          <div className="md:col-span-7 flex flex-col">
            <Card className="relative flex h-full flex-col justify-between border-2 border-indigo-600 bg-white shadow-xl shadow-indigo-100 rounded-3xl overflow-hidden p-1">
              
              {/* Badge Tiêu đề nổi bật */}
              {isProPlanActive ? (
                <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[11px] font-extrabold px-4 py-1.5 rounded-bl-2xl flex items-center gap-1 shadow-sm">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {copy.currentPlanBadge}
                </div>
              ) : (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[11px] font-extrabold px-4 py-1.5 rounded-bl-2xl flex items-center gap-1 shadow-sm">
                  <Zap className="h-3.5 w-3.5 fill-current" />
                  KHUYÊN DÙNG
                </div>
              )}

              <CardHeader className="p-6 pb-4">
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-1">
                  {isLecturer ? <UserCheck className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
                  <span>{isLecturer ? copy.lecturerTitle : copy.studentTitle}</span>
                </div>
                <CardTitle className="text-2xl font-black text-slate-900">
                  {isLecturer ? "Gói Giảng Viên Pro" : "Gói Sinh Viên Pro"}
                </CardTitle>

                {/* --- KHU VỰC CHỌN COMBO NỔI BẬT --- */}
                <div className="mt-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {copy.selectDuration}
                    </label>
                  </div>

                  {/* Lưới các nút chọn Combo */}
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {activeComboList.map((plan) => {
                      const isSelected = selectedComboId === plan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setSelectedComboId(plan.id)}
                          className={`relative flex flex-col justify-between rounded-2xl p-3 text-left transition-all outline-none border-2 ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-600/20 shadow-sm"
                              : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"
                          }`}
                        >
                          {/* Badge Tiết kiệm */}
                          {plan.discountPercent > 0 && (
                            <span
                              className={`absolute -top-2.5 right-2 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-tight shadow-sm ${
                                plan.popular
                                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                                  : "bg-emerald-600 text-white"
                              }`}
                            >
                              -{plan.discountPercent}%
                            </span>
                          )}

                          <div>
                            <div className={`text-xs font-bold ${isSelected ? "text-indigo-950" : "text-slate-800"}`}>
                              {plan.label[language]}
                            </div>
                            <div className="mt-1 text-sm font-black text-indigo-600">
                              {currency(plan.effectivePricePerMonth, language)}
                              <span className="text-[10px] font-normal text-slate-400">/th</span>
                            </div>
                          </div>

                          <div className="mt-2 text-[10px] font-medium text-slate-500 border-t border-slate-200/50 pt-1">
                            Tổng: {currency(plan.totalPrice, language)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tóm tắt Giá hiển thị lớn */}
                <div className="mt-5 rounded-2xl bg-indigo-50/50 p-4 border border-indigo-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-slate-500 block">Thanh toán theo combo đã chọn</span>
                    <div className="text-2xl font-black text-indigo-900">
                      {currency(currentProPlan.totalPrice, language)}
                      <span className="text-xs font-normal text-slate-500 ml-1">
                        ({currency(currentProPlan.effectivePricePerMonth, language)}/tháng)
                      </span>
                    </div>
                  </div>

                  {currentProPlan.discountPercent > 0 && (
                    <div className="rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-extrabold text-emerald-800 border border-emerald-200/60 flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-current text-emerald-600" />
                      <span>{copy.saveBadge(currentProPlan.discountPercent)}</span>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-6 pt-2 flex flex-1 flex-col justify-between">
                <div className="mb-6">
                  <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider block mb-3">
                    Đặc quyền cao cấp bao gồm:
                  </span>
                  <ul className="space-y-3 text-xs text-slate-700">
                    {FEATURES_BY_ROLE[userInfo.role][language].map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <div className="rounded-full bg-indigo-100 p-0.5 text-indigo-600 mt-0.5">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                        <span className="leading-relaxed font-medium">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  onClick={() => void handlePayment(currentProPlan)}
                  disabled={loadingPlan !== null || isProPlanActive}
                  className={`w-full font-bold py-6 text-sm transition-all rounded-2xl shadow-lg ${
                    isProPlanActive
                      ? "bg-emerald-600 hover:bg-emerald-600 text-white cursor-default opacity-90 shadow-none"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 hover:shadow-indigo-300"
                  }`}
                  size="lg"
                >
                  {loadingPlan === currentProPlan.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : isProPlanActive ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      {copy.usingPlan}
                    </span>
                  ) : (
                    copy.payNow
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

        </div>

        {/* BANNER KHUYẾN MÃI REFERRAL */}
        <div className="mb-8 overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-900 via-indigo-850 to-slate-900 p-6 text-white shadow-md sm:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-bold text-amber-300 border border-amber-400/30">
                <Gift className="h-3.5 w-3.5" />
                <span>REFERRAL → VOUCHER</span>
              </div>
              <h3 className="text-xl font-extrabold sm:text-2xl">{copy.referralTitle}</h3>
              <p className="text-xs text-indigo-200 max-w-xl leading-relaxed">{copy.referralDesc}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="rounded-2xl border border-indigo-400/20 bg-white/10 p-3.5 text-center backdrop-blur-md min-w-[150px]">
                <div className="flex justify-center mb-1 text-amber-400">
                  <Users className="h-4 w-4" />
                </div>
                <div className="text-[11px] text-indigo-200">Khách mới & Giới thiệu</div>
                <div className="text-lg font-black text-amber-300">Giảm 20%</div>
              </div>

              <div className="rounded-2xl border border-indigo-400/20 bg-white/10 p-3.5 text-center backdrop-blur-md min-w-[160px]">
                <div className="flex justify-center mb-1 text-emerald-400">
                  <Award className="h-4 w-4" />
                </div>
                <div className="text-[11px] text-indigo-200">{copy.referrerReward}</div>
                <div className="text-base font-extrabold text-emerald-300">
                  {isLecturer ? copy.lecturerVoucher : copy.studentVoucher}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* THÔNG BÁO LỖI */}
        {error && (
          <div className="mx-auto mb-6 max-w-md rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-xs font-semibold text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {/* MODAL HÓA ĐƠN THANH TOÁN (VIETQR) */}
        {showQrModal && selectedPlan && currentOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-opacity">
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 animate-in fade-in zoom-in-95 duration-200">
              
              <div className="bg-slate-900 px-6 py-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-xs">
                      TF
                    </div>
                    <div>
                      <h2 className="text-sm font-bold leading-none tracking-tight">TEAMFAIR</h2>
                      <p className="text-[10px] text-slate-400 mt-0.5">Hóa đơn thanh toán dịch vụ</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-300 border border-amber-500/30">
                      <Clock className="h-3 w-3 animate-pulse" />
                      Chờ thanh toán
                    </span>
                    <button
                      onClick={() => setShowQrModal(false)}
                      className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                      aria-label="Đóng"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 max-h-[85vh] overflow-y-auto">
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/80 mb-5">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] mb-0.5">Mã đơn hàng</span>
                      <span className="font-mono font-bold text-slate-800 text-xs">
                        #{currentOrder.orderReference}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] mb-0.5">Ngày tạo đơn</span>
                      <span className="font-medium text-slate-700 text-xs">{startDateStr}</span>
                    </div>

                    <div className="col-span-2 pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 block text-[10px] mb-0.5">Khách hàng</span>
                        <div className="flex items-center gap-1 font-semibold text-slate-800">
                          <UserIcon className="h-3.5 w-3.5 text-indigo-600" />
                          <span className="truncate">{userInfo.fullName || "Khách hàng"}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate">{userInfo.email}</span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] mb-0.5">Loại tài khoản</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">
                          <ShieldCheck className="h-3 w-3" />
                          {userInfo.role === "lecturer" ? "Giảng Viên" : "Sinh Viên"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-5 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4">
                  <div className="flex items-start justify-between border-b border-indigo-100 pb-2 mb-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-indigo-600 tracking-wider">
                        Gói đăng ký
                      </div>
                      <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                        {selectedPlan.id.startsWith("lecturer") ? "Gói Giảng Viên" : "Gói Sinh Viên"} — Combo {selectedPlan.label[language]}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                      {totalDays} ngày
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Tổng cộng:</span>
                    <span className="text-base font-black text-indigo-600">
                      {currency(currentOrder.amount, language)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-slate-200 p-4 bg-white">
                  <div className="flex flex-col items-center">
                    <div className="relative rounded-2xl border border-slate-200 p-2 shadow-inner bg-white">
                      <img
                        src={currentOrder.qrUrl}
                        alt="QR Code Thanh Toán VietQR"
                        className="h-40 w-40 object-contain"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <QrCode className="h-3 w-3" /> Quét mã bằng App Ngân Hàng
                    </span>
                  </div>

                  <div className="flex-1 space-y-3 w-full text-xs">
                    <div className="rounded-xl bg-amber-50 p-2.5 text-amber-800 text-[10px] border border-amber-200/80 leading-relaxed">
                      <strong>Lưu ý:</strong> Vui lòng giữ nguyên <strong>Nội dung chuyển khoản</strong> để hệ thống tự động kích hoạt gói ngay lập tức.
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Nội dung chuyển khoản</span>
                      <div className="mt-1 flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 border border-slate-200">
                        <span className="font-mono font-black text-indigo-700 text-xs tracking-wider">
                          {currentOrder.orderReference}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyRef(currentOrder.orderReference)}
                          className="h-6 px-2 text-[10px] text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                        >
                          {copiedRef ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          <span className="ml-1">{copiedRef ? "Đã chép" : "Sao chép"}</span>
                        </Button>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400">
                      Tự động kích hoạt ngay sau khi ngân hàng báo Có.
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowQrModal(false)}
                    className="rounded-xl px-5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    {copy.close}
                  </Button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}