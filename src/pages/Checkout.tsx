import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Check, Star, X } from "lucide-react";
import Swal from "sweetalert2";
import { PRO_GROUP_PRICE_VND, PRO_MAX_PRICE_VND, type BillingPlan } from "@/lib/billing";
import { useAuth } from "@/context/AuthContext";
import { useEntitlements } from "@/context/EntitlementContext";

type PricingPlan = Exclude<BillingPlan, "free"> | "free";

type Plan = {
  id: PricingPlan;
  name: string;
  price: number;
  cycle: string;
  popular?: boolean;
  features: string[];
};

type CheckoutResponse = {
  ok: true;
  data: { orderId: string; orderReference: string; amount: number; qrUrl: string };
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Miễn phí",
    price: 0,
    cycle: "mãi miễn phí",
    features: ["1 nhóm sở hữu, tối đa 6 thành viên", "Tối đa 20 task/nhóm", "200 MB storage/nhóm", "Task, deadline và calendar cơ bản"],
  },
  {
    id: "pro_group",
    name: "Pro Group",
    price: PRO_GROUP_PRICE_VND,
    cycle: "/người/tháng",
    popular: true,
    features: ["Dành riêng cho tài khoản đã trả phí", "Nhóm bạn sở hữu: tối đa 30 thành viên", "Task không giới hạn, storage 5 GB", "Analytics, export và AI nâng cao"],
  },
  {
    id: "pro_max",
    name: "Pro Max",
    price: PRO_MAX_PRICE_VND,
    cycle: "/người/tháng",
    features: ["Bao gồm toàn bộ Pro Group", "Tạo nhóm không giới hạn", "Dashboard đa project", "Storage 20 GB/nhóm"],
  },
];

const currency = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export default function Checkout() {
  const [loadingPlan, setLoadingPlan] = useState<PricingPlan | null>(null);
  const [currentOrder, setCurrentOrder] = useState<CheckoutResponse["data"] | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan: activePlan, refreshEntitlements } = useEntitlements();

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
        title: "Thanh toán thành công!",
        text: `Gói ${matchedPlan?.name || "dịch vụ"} đã được kích hoạt trong 30 ngày.`,
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
  }, [currentOrder, navigate, refreshEntitlements]);

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
      if (invokeError || !data?.ok) throw invokeError ?? new Error("Could not create payment order.");
      setCurrentOrder(data.data);
      setSelectedPlan(plan);
      setShowQrModal(true);
    } catch (paymentError) {
      console.error("Payment order creation failed:", paymentError);
      setError("Không thể tạo đơn thanh toán. Vui lòng thử lại sau.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">Chọn gói dành cho bạn</h1>
          <p className="text-lg text-gray-600">Pro là quyền cá nhân. Thành viên khác trong cùng nhóm không tự nhận quyền Pro.</p>
        </div>

        <div className="mb-12 grid gap-8 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = activePlan === plan.id;
            return (
              <div key={plan.id} className={`relative transition-transform duration-300 ${plan.popular ? "md:scale-105" : ""}`}>
                {plan.popular && <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2"><span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1 text-sm font-semibold text-white"><Star className="h-4 w-4 fill-current" />Phổ biến nhất</span></div>}
                <Card className={`flex h-full flex-col ${plan.popular ? "border-2 border-amber-500 shadow-lg" : "border-gray-200"}`}>
                  <CardHeader>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <div className="mt-4"><div className="text-4xl font-bold text-gray-900">{plan.price === 0 ? "0đ" : `${currency(plan.price)}đ`}</div><div className="mt-2 text-sm text-gray-600">{plan.cycle}</div></div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    <ul className="mb-6 flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex gap-3 text-sm"><Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" /><span className="text-gray-700">{feature}</span></li>)}</ul>
                    <Button onClick={() => void handlePayment(plan)} disabled={loadingPlan !== null || isCurrent} className={`w-full ${plan.popular ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600" : ""}`} size="lg">
                      {loadingPlan === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isCurrent ? "Đang sử dụng" : plan.id === "free" ? "Sử dụng miễn phí" : "Thanh toán ngay"}
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
              <button onClick={() => setShowQrModal(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600" aria-label="Đóng"><X className="h-6 w-6" /></button>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Quét mã thanh toán</h3>
              <p className="mb-4 text-sm text-gray-500">Gói: <span className="font-semibold text-gray-800">{selectedPlan.name}</span></p>
              <div className="mb-4 inline-block rounded-xl border border-gray-100 bg-slate-50 p-4"><img src={currentOrder.qrUrl} alt="VietQR thanh toán" className="mx-auto h-64 w-64 object-contain" /></div>
              <div className="mb-4 space-y-1 rounded-xl border border-blue-100 bg-blue-50 p-3 text-left text-xs text-blue-800"><p><strong>Số tiền:</strong> {currency(currentOrder.amount)}đ</p><p><strong>Nội dung CK:</strong> <span className="rounded bg-red-50 px-1 font-bold text-red-600">{currentOrder.orderReference}</span></p></div>
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-amber-600"><Loader2 className="h-4 w-4 animate-spin" />Đang đợi xác nhận thanh toán...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
