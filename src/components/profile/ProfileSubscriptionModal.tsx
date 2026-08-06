import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    id: "trial",
    title: "Trial",
    badgeIcon: "🧪",
    description: "30 dias gratuitos.",
    price: "R$ 0,00",
    buttonLabel: "Continuar Trial",
    bg: "bg-emerald-50/50",
    border: "border-emerald-200/60",
    text: "text-emerald-700"
  },
  {
    id: "premium",
    title: "Premium",
    badgeIcon: "💎",
    description: "Acesso completo durante 1 ano.",
    price: "R$ 99,90",
    buttonLabel: "Assinar Premium",
    bg: "bg-blue-50/50",
    border: "border-blue-200/60",
    text: "text-blue-700"
  },
  {
    id: "lifetime",
    title: "Vitalício",
    badgeIcon: "👑",
    description: "Pagamento único com acesso permanente.",
    price: "R$ 299,90",
    buttonLabel: "Comprar Vitalício",
    bg: "bg-amber-50/50",
    border: "border-amber-200/60",
    text: "text-amber-700"
  }
];

interface ProfileSubscriptionModalProps {
  currentPlanId?: string;
}

export function ProfileSubscriptionModal({ currentPlanId }: ProfileSubscriptionModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const { showSuccessToast } = useToast();

  const handleSelectPlan = (planId: string) => {
    showSuccessToast("Em breve você poderá contratar este plano diretamente pelo aplicativo.");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full mt-3 rounded-[16px] bg-gradient-to-b from-[#3B82F6] to-[#2563EB] hover:opacity-90 text-white font-bold text-[17px] shadow-[0_4px_14px_rgba(37,99,235,0.3)] h-12 transition-all hover:translate-y-[-1px]">
          <CreditCard className="w-4 h-4 mr-2 text-white/90" />
          Gerenciar Assinatura
        </Button>
      </DialogTrigger>
      
      <DialogContent className={cn("rounded-3xl p-5 md:p-6", isMobile ? "w-[95vw] max-w-[95vw] overflow-y-auto max-h-[90vh]" : "sm:max-w-[425px]")}>
        <DialogHeader className="mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xl leading-none">💳</span>
            <DialogTitle className="text-[17px] font-extrabold text-[#1E3A8B] tracking-tight">Gerenciar Assinatura</DialogTitle>
          </div>
          <DialogDescription className="text-slate-500 font-medium text-left text-[13px] leading-snug">
            Escolha o plano que melhor atende às suas necessidades.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2.5 pb-2">
          {PLANS.map((plan) => {
            const isCurrent = (currentPlanId === plan.id) || (!currentPlanId && plan.id === "trial");

            return (
              <div key={plan.id} className={cn(
                "relative flex flex-col px-4 py-3 rounded-[16px] border shadow-[0_2px_10px_rgba(0,0,0,0.03)] transition-all hover:shadow-md",
                isCurrent ? "bg-blue-50/40 border-blue-300" : "bg-white border-slate-100"
              )}>
                {/* Identificador de Plano Atual discreto */}
                {isCurrent && (
                  <div className="absolute top-3 right-3">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-white",
                      plan.border, plan.text
                    )}>
                      Plano Atual
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-lg">{plan.badgeIcon}</span>
                  <h3 className="text-[15px] font-bold text-slate-800">{plan.title}</h3>
                  {plan.id === "lifetime" && !isCurrent && (
                    <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 shadow-[0_1px_2px_rgba(245,158,11,0.05)]">
                      ⭐ Recomendado
                    </span>
                  )}
                </div>
                
                <p className="text-[12px] font-medium text-slate-500 mb-1.5 pr-16 leading-tight">{plan.description}</p>
                
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-[21px] font-extrabold text-slate-800">{plan.price}</span>
                  <Button 
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrent}
                    className={cn(
                      "h-8 px-3 rounded-[10px] font-bold transition-all text-[12px]",
                      isCurrent 
                        ? "bg-slate-100 text-slate-500 hover:bg-slate-100 cursor-default shadow-none border border-slate-200"
                        : "bg-slate-800 text-white hover:bg-slate-700 active:scale-95 shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
                    )}
                  >
                    {isCurrent ? "Em uso" : plan.buttonLabel}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-1 pt-3 border-t border-slate-100/80">
          <p className="text-[11.5px] text-slate-600 font-semibold text-center px-2 leading-tight">
            Todos os planos pagos incluem acesso completo a todas as funcionalidades do aplicativo.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
