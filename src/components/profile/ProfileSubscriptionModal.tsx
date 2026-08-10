import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Check, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  billing_type?: string | null;
  duration_days?: number | null;
  is_lifetime?: boolean | null;
  badge_text?: string | null;
  badge_color?: string | null;
  is_active?: boolean;
  is_visible?: boolean;
  display_order?: number;
}

const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: "plan-trial",
    code: "trial",
    name: "Trial",
    description: "30 dias gratuitos.",
    price: 0.00,
    duration_days: 30,
    is_lifetime: false,
    badge_text: "🧪",
    display_order: 1
  },
  {
    id: "plan-premium-monthly",
    code: "premium_monthly",
    name: "Premium Mensal",
    description: "Acesso completo por 1 mês.",
    price: 14.90,
    billing_type: "monthly",
    duration_days: 30,
    is_lifetime: false,
    badge_text: "💎",
    display_order: 2
  },
  {
    id: "plan-premium-yearly",
    code: "premium_yearly",
    name: "Premium Anual",
    description: "Acesso completo por 1 ano.",
    price: 99.90,
    billing_type: "yearly",
    duration_days: 365,
    is_lifetime: false,
    badge_text: "💎",
    display_order: 3
  },
  {
    id: "plan-lifetime",
    code: "lifetime",
    name: "Vitalício",
    description: "Pagamento único com acesso permanente.",
    price: 299.90,
    is_lifetime: true,
    badge_text: "👑",
    display_order: 4
  }
];

interface ProfileSubscriptionModalProps {
  currentPlanId?: string;
  subscriptionStatus?: string;
  paymentStatus?: string;
  hasActiveSubscription?: boolean;
  isExpired?: boolean;
  expiresAt?: string | null;
  hideTrigger?: boolean;
  onSelectPlan?: (plan: SubscriptionPlan) => void;
}

export function ProfileSubscriptionModal({ currentPlanId, subscriptionStatus, paymentStatus, hasActiveSubscription, isExpired: globalIsExpired, expiresAt, hideTrigger, onSelectPlan }: ProfileSubscriptionModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [premiumPeriod, setPremiumPeriod] = useState<"monthly" | "yearly">("yearly");
  const isMobile = useIsMobile();
  const { showSuccessToast, showErrorToast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenModal = () => setIsOpen(true);
    window.addEventListener("open-subscription-modal", handleOpenModal);
    return () => window.removeEventListener("open-subscription-modal", handleOpenModal);
  }, []);

  const { data: fetchedPlans } = useQuery({
    queryKey: ["subscription_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans" as any)
        .select("*")
        .eq("is_active", true)
        .eq("is_visible", true)
        .order("display_order", { ascending: true });
      
      if (error) {
        console.warn("Using fallback plans (subscription_plans error or empty):", error);
        return DEFAULT_PLANS;
      }
      return (data && data.length > 0) ? (data as unknown as SubscriptionPlan[]) : DEFAULT_PLANS;
    },
    enabled: isOpen,
  });

  const plans = (fetchedPlans && fetchedPlans.length > 0) ? fetchedPlans : DEFAULT_PLANS;

  const trialPlan = plans.find(p => p.code === "trial") || DEFAULT_PLANS[0];
  const premiumMonthlyPlan = plans.find(p => p.code === "premium_monthly") || DEFAULT_PLANS[1];
  const premiumYearlyPlan = plans.find(p => p.code === "premium_yearly") || DEFAULT_PLANS[2];
  const lifetimePlan = plans.find(p => p.code === "lifetime") || DEFAULT_PLANS[3];

  const selectedPremiumPlan = premiumPeriod === "yearly" ? premiumYearlyPlan : premiumMonthlyPlan;

  // Dynamic annual savings calculation
  const monthlyPrice = premiumMonthlyPlan.price > 0 ? premiumMonthlyPlan.price : 14.90;
  const yearlyPrice = premiumYearlyPlan.price > 0 ? premiumYearlyPlan.price : 99.90;
  const savingsValue = Math.max(0, (monthlyPrice * 12) - yearlyPrice);

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (onSelectPlan) {
      onSelectPlan(plan);
    }
    
    try {
      setLoadingPlan(plan.code);
      
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan_code: plan.code }
      });
      
      if (error) throw error;
      
      if (data?.success && data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error(data?.error || "Erro desconhecido ao gerar checkout");
      }
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      showErrorToast("Não foi possível iniciar o pagamento. Tente novamente em alguns instantes.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const isSubscriptionActive = subscriptionStatus === "active" && paymentStatus === "approved";
  const effectivePlanId = isSubscriptionActive ? (currentPlanId || "trial") : "trial";

  const isPremiumUser = effectivePlanId.startsWith("premium") || effectivePlanId === "premium";
  const isLifetimeUser = effectivePlanId === "lifetime";
  const isTrialUser = effectivePlanId === "trial";

  const isBlocked = subscriptionStatus === "blocked";
  const hasActivePremiumOrLifetime = (isPremiumUser || isLifetimeUser) && !globalIsExpired;

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button className="w-full mt-3 rounded-[16px] bg-gradient-to-b from-[#3B82F6] to-[#2563EB] hover:opacity-90 text-white font-bold text-[17px] shadow-[0_4px_14px_rgba(37,99,235,0.3)] h-12 transition-all hover:translate-y-[-1px]">
            {isPremiumUser && subscriptionStatus === 'expired' ? (
              <>
                <span className="mr-2 text-lg leading-none">🔄</span>
                Renovar Assinatura
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2 text-white/90" />
                Gerenciar Assinatura
              </>
            )}
          </Button>
        </DialogTrigger>
      )}
      
      <DialogContent className={cn("rounded-3xl p-5 md:p-6 overflow-x-hidden overflow-y-auto max-h-[90vh]", isMobile ? "w-[calc(95vw+2px)] max-w-[calc(95vw+2px)]" : "w-full sm:max-w-[425px]")}>
        <DialogHeader className="mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xl leading-none">💳</span>
            <DialogTitle className="text-[17px] font-extrabold text-[#1E3A8B] tracking-tight">Gerenciar Assinatura</DialogTitle>
          </div>
          {isBlocked ? (
            <DialogDescription className="text-red-500 font-bold text-left text-[13px] leading-snug">
              Sua conta está bloqueada. Não é possível realizar upgrades no momento.
            </DialogDescription>
          ) : (
            <DialogDescription className="text-slate-500 font-medium text-left text-[13px] leading-snug">
              Escolha o plano que melhor atende às suas necessidades.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-2.5 pb-1">
          {/* 1. CARD TRIAL */}
          {(() => {
            const plan = trialPlan;
            const isCurrent = isTrialUser;
            const isExpired = subscriptionStatus === "expired" && isCurrent;

            return (
              <div key={plan.code} className={cn(
                "relative flex flex-col px-4 py-3 rounded-[16px] border transition-all min-h-[124px] animate-in fade-in slide-in-from-bottom-1 duration-200 ease-out",
                isExpired
                  ? "bg-red-50/30 border-[#F2AAAA] shadow-none"
                  : isCurrent 
                    ? "bg-blue-50/40 border-blue-300 shadow-[0_2px_10px_rgba(0,0,0,0.03)]" 
                    : hasActivePremiumOrLifetime
                      ? "opacity-[0.96] saturate-[0.85] bg-slate-50 border-slate-100 shadow-none"
                      : "bg-white border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
              )}>
                {isCurrent && (
                  <div className="absolute top-3 right-3">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                      isExpired
                        ? "bg-red-100 text-red-700 border-red-200"
                        : "bg-white border-emerald-200 text-emerald-700"
                    )}>
                      {isExpired ? "Plano Expirado" : "Plano Atual"}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-lg">🧪</span>
                  <h3 className={cn("text-[15px] font-bold", isExpired ? "text-red-700" : "text-slate-800")}>
                    Trial {isExpired ? "Expirado" : ""}
                  </h3>
                </div>
                
                <p className={cn("mb-1.5 pr-16 text-[12px] font-medium leading-tight", 
                  isExpired ? "text-slate-400" : (hasActivePremiumOrLifetime && !isCurrent) ? "text-slate-400" : "text-slate-500"
                )}>
                  {plan.description || "30 dias gratuitos."}
                </p>
                
                <div className="flex items-center justify-between mt-auto">
                  <span className={cn("font-extrabold flex items-baseline gap-0.5", 
                    isExpired ? "text-slate-400" :
                    isCurrent ? "text-[#1E3A8B] text-[24px]" : "text-slate-800"
                  )}>
                    <span className="text-[14px] opacity-80">R$</span>
                    <span className={cn("tracking-tight", isCurrent && !isExpired ? "text-[26px]" : "text-[21px]")}>
                      {formatPrice(plan.price)}
                    </span>
                  </span>
                  
                  {isCurrent && isExpired && (
                    <span className="text-[12.5px] font-medium text-[#5B6475] text-right max-w-[120px] leading-tight flex-shrink-0">
                      Seu período gratuito terminou.
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 2. CARD PREMIUM */}
          {(() => {
            const isCurrent = isPremiumUser;
            const isExpired = subscriptionStatus === "expired" && isCurrent;
            const isInferior = isLifetimeUser;
            const isHighlighted = isCurrent && !isExpired;

            const activePremiumPlan = plans.find(p => p.code === effectivePlanId) || selectedPremiumPlan;
            const plan = isHighlighted ? activePremiumPlan : selectedPremiumPlan;
            const displayedPeriod = isHighlighted 
              ? (plan.code === "premium_yearly" ? "yearly" : "monthly") 
              : premiumPeriod;

            return (
              <div key="card-premium" className={cn(
                "relative flex flex-col px-4 py-3 rounded-[16px] border transition-all min-h-[124px] animate-in fade-in slide-in-from-bottom-1 duration-200 ease-out delay-75 fill-mode-backwards",
                isInferior || (isBlocked && !isCurrent)
                  ? "opacity-[0.96] cursor-default bg-slate-50 border-slate-100 shadow-none" 
                  : isExpired
                    ? "bg-red-50/50 border-red-200/60 shadow-[0_2px_10px_rgba(239,68,68,0.05)]"
                    : isHighlighted
                      ? "bg-gradient-to-b from-[#355ea8] to-[#1E3A8B] border-[#81a1eb]/50 shadow-[0_8px_25px_rgba(30,58,139,0.18)]"
                      : hasActivePremiumOrLifetime
                        ? "opacity-[0.96] bg-slate-50 border-slate-100 shadow-none"
                        : "bg-white border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-md"
              )}>
                {isCurrent && (
                  <div className="absolute top-3 right-3">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                      isExpired
                        ? "bg-red-100 text-red-700 border-red-200"
                        : "bg-amber-400 text-amber-900 border-amber-300 shadow-sm"
                    )}>
                      {isExpired ? "Plano Expirado" : "Plano Atual"}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💎</span>
                    <h3 className={cn("text-[15px] font-bold", isHighlighted ? "text-white" : isExpired ? "text-red-700" : "text-slate-800")}>
                      Premium {isExpired ? "Expirado" : ""}
                    </h3>
                  </div>

                  {/* TOGGLE MENSAL / ANUAL */}
                  {!isHighlighted && (
                    <ToggleGroup
                      type="single"
                      value={premiumPeriod}
                      onValueChange={(v) => v && setPremiumPeriod(v as "monthly" | "yearly")}
                      className={cn(
                        "btn-3d flex items-center justify-between p-1 rounded-full transition-all h-8 w-[130px] border shadow-none cursor-default",
                        isHighlighted ? "bg-white/10 border-white/20" : "bg-slate-100/90 border-slate-200/80"
                      )}
                      style={{
                        "--cor-topo": isHighlighted ? "rgba(255,255,255,0.15)" : "#E6F0FF",
                        "--cor-base": isHighlighted ? "rgba(255,255,255,0.05)" : "#DCEBFF",
                        boxShadow: isHighlighted ? "inset 0px 1px 2px rgba(255, 255, 255, 0.1), inset 0px -2px 3px rgba(0, 0, 0, 0.2)" : "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.1)"
                      } as any}
                    >
                      <ToggleGroupItem
                        value="monthly"
                        className={cn(
                          "rounded-full flex-1 text-[11px] font-bold h-6 transition-all",
                          isHighlighted
                            ? "data-[state=on]:bg-white data-[state=on]:text-[#1E3A8B] text-white/70"
                            : "data-[state=on]:bg-gradient-to-b data-[state=on]:from-[#4B76D1] data-[state=on]:to-[#3555A2] data-[state=on]:text-white data-[state=on]:shadow-[inset_0px_1px_1px_rgba(255,255,255,0.4),inset_0px_-1px_1px_rgba(0,0,0,0.1)] text-[#1E6BCE]"
                        )}
                      >
                        Mensal
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="yearly"
                        className={cn(
                          "rounded-full flex-1 text-[11px] font-bold h-6 transition-all",
                          isHighlighted
                            ? "data-[state=on]:bg-white data-[state=on]:text-[#1E3A8B] text-white/70"
                            : "data-[state=on]:bg-gradient-to-b data-[state=on]:from-[#4B76D1] data-[state=on]:to-[#3555A2] data-[state=on]:text-white data-[state=on]:shadow-[inset_0px_1px_1px_rgba(255,255,255,0.4),inset_0px_-1px_1px_rgba(0,0,0,0.1)] text-[#1E6BCE]"
                        )}
                      >
                        Anual
                      </ToggleGroupItem>
                    </ToggleGroup>
                  )}
                </div>
                
                <p className={cn("text-[12px] font-medium mb-1 pr-4 leading-tight", 
                  isHighlighted ? "text-white/80" : "text-slate-500"
                )}>
                  {plan.description || (displayedPeriod === "yearly" ? "Acesso completo por 1 ano." : "Acesso completo por 1 mês.")}
                </p>

                <div className="mt-auto flex flex-col pt-1">
                  {!isHighlighted && (
                    <div className="h-[20px] mb-0.5 flex items-end">
                      {displayedPeriod === "yearly" && savingsValue > 0 && (
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1 leading-none",
                          isHighlighted
                            ? "bg-emerald-400/20 text-emerald-300 border-emerald-400/30"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        )}>
                          💚 Economize R$ {formatPrice(savingsValue)}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className={cn("font-extrabold flex items-baseline gap-0.5", isHighlighted ? "text-white" : "text-slate-800")}>
                        <span className="text-[14px] opacity-80">R$</span>
                        <span className="text-[21px] tracking-tight">{formatPrice(plan.price)}</span>
                        <span className="text-[11px] font-normal opacity-75 ml-0.5">
                          /{displayedPeriod === "yearly" ? "ano" : "mês"}
                        </span>
                      </span>
                    </div>
                  
                  {isHighlighted ? (
                    <div className="flex items-center justify-end gap-1 text-emerald-300 font-bold text-[11px] h-8 px-1">
                      <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3} />
                      <span className="leading-none mt-[1px] whitespace-nowrap">
                        Acesso Premium ativo
                      </span>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => handleSelectPlan(plan)}
                      disabled={(isCurrent && !isExpired) || isInferior || isBlocked || loadingPlan === plan.code}
                      className={cn(
                        "h-8 px-3 rounded-[10px] font-bold transition-all text-[12px]",
                        (isCurrent && !isExpired) || isInferior || isBlocked
                          ? "bg-slate-100 text-slate-500 hover:bg-slate-100 cursor-default shadow-none border border-slate-200"
                          : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-[0_4px_10px_rgba(37,99,235,0.3)] hover:scale-[1.03]"
                      )}
                    >
                      {loadingPlan === plan.code ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Preparando...
                        </>
                      ) : isCurrent 
                        ? (isExpired ? "Renovar Premium" : "Em uso") 
                        : "Assinar Premium"}
                    </Button>
                  )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 3. CARD VITALÍCIO */}
          {(() => {
            const plan = lifetimePlan;
            const isCurrent = isLifetimeUser;
            const isExpired = subscriptionStatus === "expired" && isCurrent;
            const isHighlighted = isCurrent && !isExpired;

            return (
              <div key={plan.code} className={cn(
                "relative flex flex-col px-4 py-3 rounded-[16px] border transition-all min-h-[124px] animate-in fade-in slide-in-from-bottom-1 duration-200 ease-out delay-150 fill-mode-backwards",
                isBlocked && !isCurrent
                  ? "opacity-[0.96] cursor-default bg-slate-50 border-slate-100 shadow-none" 
                  : isHighlighted
                    ? "bg-gradient-to-b from-[#355ea8] to-[#1E3A8B] border-[#81a1eb]/50 shadow-[0_8px_25px_rgba(30,58,139,0.18)]"
                    : hasActivePremiumOrLifetime
                      ? "opacity-[0.96] bg-slate-50 border-slate-100 shadow-none"
                      : "bg-white border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-md"
              )}>
                {isCurrent && (
                  <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-400 text-amber-900 border-amber-300 shadow-sm">
                      Plano Atual
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-lg flex items-center">👑</span>
                  <h3 className={cn("text-[15px] font-bold flex items-center", isHighlighted ? "text-white" : "text-slate-800")}>
                    Vitalício
                  </h3>
                  {!isCurrent && !isBlocked && (
                    <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 shadow-[0_1px_2px_rgba(245,158,11,0.05)] leading-none h-[22px]">
                      ⭐ Recomendado
                    </span>
                  )}
                </div>
                
                <p className={cn("mb-1.5 pr-16 text-[11px] font-normal leading-snug", 
                  isHighlighted ? "text-white/80" : "text-slate-500"
                )}>
                  {plan.description || "Pagamento único com acesso permanente."}
                </p>
                
                <div className="flex items-center justify-between mt-auto">
                  <span className={cn("font-extrabold flex items-baseline gap-0.5", isHighlighted ? "text-white" : "text-slate-800")}>
                    <span className="text-[14px] opacity-80">R$</span>
                    <span className="text-[21px] tracking-tight">{formatPrice(plan.price)}</span>
                  </span>
                  
                  {isHighlighted ? (
                    <div className="flex items-center justify-end gap-1 text-emerald-300 font-bold text-[11px] h-8 px-1">
                      <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3} />
                      <span className="leading-none mt-[1px] whitespace-nowrap">
                        Acesso vitalício ativo
                      </span>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isCurrent || isBlocked || loadingPlan === plan.code}
                      className={cn(
                        "h-8 px-3 rounded-[10px] font-bold transition-all text-[12px]",
                        isCurrent || isBlocked
                          ? "bg-slate-100 text-slate-500 hover:bg-slate-100 cursor-default shadow-none border border-slate-200"
                          : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-[0_4px_10px_rgba(37,99,235,0.3)] hover:scale-[1.03]"
                      )}
                    >
                      {loadingPlan === plan.code ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Preparando...
                        </>
                      ) : isCurrent ? "Em uso" : "Comprar Vitalício"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        
        <div className="mt-0 pt-2 border-t border-slate-100/80 flex flex-col items-center pb-0">
          <div className="flex items-center justify-center gap-1 flex-wrap text-center">
            <span className="text-[11.5px] text-slate-500 font-medium">
              Obrigado por apoiar o desenvolvimento do
            </span>
            <div className="flex items-center gap-1">
              <img src="/icons/logo.png" alt="Logo" className="w-3.5 h-3.5 object-contain opacity-90" />
              <span className="font-extrabold text-[12.5px] tracking-tight text-[#1E3A8B]" style={{ fontFamily: "'Inter', sans-serif" }}>
                Minhas Finança<span className="text-[#22c55e] font-medium drop-shadow-sm">$</span>
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

