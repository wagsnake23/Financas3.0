import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Check } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    id: "trial",
    title: "Trial",
    badgeIcon: "🧪",
    description: "30 dias gratuitos.",
    price: "0,00",
    buttonLabel: "Continuar Trial",
    bg: "bg-emerald-50/50",
    border: "border-emerald-200/60",
    text: "text-emerald-700",
    level: 1
  },
  {
    id: "premium",
    title: "Premium",
    badgeIcon: "💎",
    description: "Acesso completo durante 1 ano.",
    price: "99,90",
    buttonLabel: "Assinar Premium",
    bg: "bg-blue-50/50",
    border: "border-blue-200/60",
    text: "text-blue-700",
    level: 2
  },
  {
    id: "lifetime",
    title: "Vitalício",
    badgeIcon: "👑",
    description: "Pagamento único com acesso permanente.",
    price: "299,90",
    buttonLabel: "Comprar Vitalício",
    bg: "bg-amber-50/50",
    border: "border-amber-200/60",
    text: "text-amber-700",
    level: 3
  }
];

interface ProfileSubscriptionModalProps {
  currentPlanId?: string;
  subscriptionStatus?: string;
}

export function ProfileSubscriptionModal({ currentPlanId, subscriptionStatus }: ProfileSubscriptionModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const { showSuccessToast } = useToast();

  const handleSelectPlan = (planId: string) => {
    showSuccessToast("Em breve você poderá contratar este plano diretamente pelo aplicativo.");
  };

  const actualPlanId = currentPlanId || "trial";
  const currentLevel = PLANS.find(p => p.id === actualPlanId)?.level || 1;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full mt-3 rounded-[16px] bg-gradient-to-b from-[#3B82F6] to-[#2563EB] hover:opacity-90 text-white font-bold text-[17px] shadow-[0_4px_14px_rgba(37,99,235,0.3)] h-12 transition-all hover:translate-y-[-1px]">
          {actualPlanId === 'premium' && subscriptionStatus === 'expired' ? (
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
      
      <DialogContent className={cn("rounded-3xl p-5 md:p-6", isMobile ? "w-[95vw] max-w-[95vw] overflow-y-auto max-h-[90vh]" : "sm:max-w-[425px]")}>
        <DialogHeader className="mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xl leading-none">💳</span>
            <DialogTitle className="text-[17px] font-extrabold text-[#1E3A8B] tracking-tight">Gerenciar Assinatura</DialogTitle>
          </div>
          {subscriptionStatus === 'blocked' ? (
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
          {PLANS.map((plan) => {
            const isCurrent = actualPlanId === plan.id;
            const isBlocked = subscriptionStatus === "blocked";
            const isExpired = subscriptionStatus === "expired" && isCurrent;
            const isInferior = plan.level < currentLevel;
            const isHighlighted = isCurrent && !isExpired && (plan.id === "lifetime" || plan.id === "premium");

            return (
              <div key={plan.id} className={cn(
                "relative flex flex-col px-4 py-3 rounded-[16px] border transition-all",
                isInferior || (isBlocked && !isCurrent)
                  ? "opacity-60 cursor-default bg-white border-slate-100 shadow-none" 
                  : isExpired
                    ? "bg-red-50/50 border-red-200/60 shadow-[0_2px_10px_rgba(239,68,68,0.05)]"
                    : isHighlighted
                      ? "bg-[#1E3A8B] border-blue-400/30 shadow-md"
                      : isCurrent 
                        ? "bg-blue-50/40 border-blue-300 shadow-[0_2px_10px_rgba(0,0,0,0.03)]" 
                        : "bg-white border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-md"
              )}>
                {/* Identificador de Plano Atual discreto */}
                {isCurrent && (
                  <div className="absolute top-3 right-3">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                      isExpired
                        ? "bg-red-100 text-red-700 border-red-200"
                        : isHighlighted 
                          ? "bg-amber-400 text-amber-900 border-amber-300 shadow-sm"
                          : cn("bg-white", plan.border, plan.text)
                    )}>
                      {isExpired ? "Plano Expirado" : "Plano Atual"}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-lg">{plan.badgeIcon}</span>
                  <h3 className={cn("text-[15px] font-bold", isHighlighted ? "text-white" : isExpired ? "text-red-700" : "text-slate-800")}>
                    {plan.title} {isExpired ? "Expirado" : ""}
                  </h3>
                  {plan.id === "lifetime" && !isCurrent && !isInferior && !isBlocked && (
                    <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 shadow-[0_1px_2px_rgba(245,158,11,0.05)]">
                      ⭐ Recomendado
                    </span>
                  )}
                </div>
                
                <p className={cn("text-[12px] font-medium mb-1.5 pr-16 leading-tight", isHighlighted ? "text-white/80" : "text-slate-500")}>
                  {plan.description}
                </p>
                
                <div className="flex items-center justify-between mt-auto">
                  <span className={cn("font-extrabold flex items-baseline gap-0.5", isHighlighted ? "text-white" : "text-slate-800")}>
                    <span className="text-[14px] opacity-80">R$</span>
                    <span className="text-[21px] tracking-tight">{plan.price}</span>
                  </span>
                  
                  {isHighlighted ? (
                    <div className="flex items-center justify-end gap-1 text-emerald-300 font-bold text-[11px] h-8 px-1">
                      <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3} />
                      <span className="leading-none mt-[1px] whitespace-nowrap">
                        Acesso {plan.id === "lifetime" ? "vitalício" : "Premium"} ativo
                      </span>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={(isCurrent && !isExpired) || isInferior || isBlocked}
                      className={cn(
                        "h-8 px-3 rounded-[10px] font-bold transition-all text-[12px]",
                        (isCurrent && !isExpired) || isInferior || isBlocked
                          ? "bg-slate-100 text-slate-500 hover:bg-slate-100 cursor-default shadow-none border border-slate-200"
                          : "bg-slate-800 text-white hover:bg-slate-700 active:scale-95 shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                      )}
                    >
                      {isCurrent 
                        ? (isExpired && plan.id === 'premium' ? "Renovar Premium" : "Em uso") 
                        : plan.buttonLabel}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
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
