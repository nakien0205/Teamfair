import { LockKeyhole } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEntitlements } from "@/context/EntitlementContext";
import { hasProGroupFeatures, hasProMaxFeatures } from "@/lib/billing";

type RequiredPlan = "pro_group" | "pro_max";

export function PremiumGate({ requiredPlan = "pro_group", children }: { requiredPlan?: RequiredPlan; children: React.ReactNode }) {
  const { plan, loading } = useEntitlements();
  const navigate = useNavigate();
  const allowed = requiredPlan === "pro_max" ? hasProMaxFeatures(plan) : hasProGroupFeatures(plan);

  if (loading || allowed) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-35 blur-[1px]" aria-hidden="true">{children}</div>
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="max-w-sm rounded-xl border bg-background/95 p-4 text-center shadow-lg">
          <LockKeyhole className="mx-auto mb-2 h-5 w-5 text-amber-600" />
          <p className="text-sm font-semibold">Tính năng dành cho {requiredPlan === "pro_max" ? "Pro Max" : "Pro Group"}</p>
          <Button className="mt-3" size="sm" onClick={() => navigate("/checkout")}>Nâng cấp gói</Button>
        </div>
      </div>
    </div>
  );
}
