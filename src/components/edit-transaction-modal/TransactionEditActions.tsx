import React from "react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import DynamicIcon from "@/components/DynamicIcon";
import { cn } from "@/lib/utils";
import { Lock, Save, Trash } from "lucide-react";

interface TransactionEditActionsProps {
  onTriggerDeleteConfirmation: () => void;
  onSave: (e?: React.FormEvent) => void;
  onCancel: () => void;
  isSaving: boolean;
  isDeleting: boolean;
  isMobile: boolean;
  isRecurringTransaction: boolean;
  className?: string;
}

export const TransactionEditActions: React.FC<TransactionEditActionsProps> = ({
  onTriggerDeleteConfirmation,
  onSave,
  onCancel,
  isSaving,
  isDeleting,
  isMobile,
  isRecurringTransaction,
  className,
}) => {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const isExpired = profile?.isExpired;

  const handleBlockedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.error("🔒 Sua assinatura expirou. Renove para voltar a editar seus dados.", { duration: 2000 });
    setTimeout(() => {
      window.dispatchEvent(new Event("open-subscription-modal"));
    }, 2000);
  };

  const isLoading = isSaving || isDeleting;

  return (
    <div className={cn("w-full flex flex-row items-center justify-between gap-3 relative", className)}>
      <Button
        type="button"
        variant="ghost"
        onClick={onTriggerDeleteConfirmation}
        className={cn(
          "group flex-1 h-[51px] rounded-xl bg-gradient-to-b from-white to-[#F8FAFC] hover:from-white hover:to-[#F1F5F9] active:to-[#E2E8F0] text-slate-800 border border-slate-300 shadow-[inset_0_-1px_0_rgba(255,255,255,0.7),0_1px_1px_rgba(15,23,42,0.04),0_3px_8px_rgba(15,23,42,0.05)] hover:shadow-[inset_0_-1px_0_rgba(255,255,255,0.8),0_2px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.06)] hover:-translate-y-[1px] font-bold text-[16px] [text-shadow:0_1px_0_rgba(255,255,255,0.95),_0_-1px_0_rgba(15,23,42,0.02)] flex items-center justify-center gap-1.5 transition-all duration-[180ms] ease-out focus-visible:ring-0 focus-visible:ring-offset-0 cursor-pointer"
        )}
        disabled={isLoading}
      >
        <Trash className="h-[18px] w-[18px] text-red-500 opacity-90 transition-transform duration-[180ms] ease-out group-hover:scale-105" strokeWidth={2.5} />
        Excluir
      </Button>

      <Button
        type={isExpired ? "button" : "submit"}
        variant="ghost"
        className={cn(
          "group flex-1 h-[51px] rounded-xl bg-gradient-to-b from-slate-100 to-[#E2E8F0]/40 hover:from-slate-100 hover:to-[#E2E8F0]/70 active:to-[#CBD5E1]/60 text-slate-900 border border-slate-300 shadow-[inset_0_-1px_0_rgba(255,255,255,0.5),0_1px_1px_rgba(15,23,42,0.04),0_3px_8px_rgba(15,23,42,0.05)] hover:shadow-[inset_0_-1px_0_rgba(255,255,255,0.6),0_2px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.06)] hover:-translate-y-[1px] font-bold text-[16px] [text-shadow:0_1px_0_rgba(255,255,255,0.95),_0_-1px_0_rgba(15,23,42,0.02)] flex items-center justify-center gap-1.5 transition-all duration-[180ms] ease-out focus-visible:ring-0 focus-visible:ring-offset-0 cursor-pointer",
          isExpired && "opacity-80"
        )}
        disabled={!isExpired && isLoading}
        onClick={isExpired ? handleBlockedClick : onSave}
      >
        <Save className="h-[18px] w-[18px] text-green-500 opacity-90 transition-transform duration-[180ms] ease-out group-hover:scale-105" strokeWidth={2.5} />
        {isLoading && !isExpired ? "Salvando..." : "Salvar"}
        {isExpired && <span className="ml-1 text-[16px]">🔒</span>}
      </Button>
    </div>
  );
};
