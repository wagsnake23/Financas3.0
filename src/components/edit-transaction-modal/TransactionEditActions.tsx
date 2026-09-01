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
    <div className={cn("w-full", className)}>
      <div className="w-full flex flex-row items-center justify-between border border-slate-300/60 bg-[#F8FAFC] shadow-[0_2px_8px_rgba(0,0,0,0.05)] rounded-xl overflow-hidden h-[51px] relative">
        <Button
          type="button"
          variant="ghost"
          onClick={onTriggerDeleteConfirmation}
          className={cn(
            "group flex-1 h-full rounded-none bg-transparent hover:bg-[rgba(239,68,68,0.04)] active:bg-[rgba(239,68,68,0.08)] text-slate-800 hover:text-slate-900 border-none shadow-none font-bold text-[16px] [text-shadow:0_1px_0_rgba(255,255,255,0.95),_0_-1px_0_rgba(15,23,42,0.05)] flex items-center justify-center gap-1.5 transition-all duration-[180ms] ease-in-out focus-visible:ring-0 focus-visible:ring-offset-0 cursor-pointer"
          )}
          disabled={isLoading}
        >
          <Trash className="h-[18px] w-[18px] text-red-500 opacity-90 transition-transform duration-[180ms] ease-in-out group-hover:scale-105" strokeWidth={2.5} />
          Excluir
        </Button>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-[60%] bg-slate-200 z-10 pointer-events-none" />

        <Button
          type={isExpired ? "button" : "submit"}
          variant="ghost"
          className={cn(
            "group flex-1 h-full rounded-none bg-[rgba(34,197,94,0.04)] hover:bg-[rgba(34,197,94,0.06)] active:bg-[rgba(34,197,94,0.10)] text-slate-900 hover:text-black shadow-none font-bold text-[16px] [text-shadow:0_1px_0_rgba(255,255,255,0.95),_0_-1px_0_rgba(15,23,42,0.05)] flex items-center justify-center gap-1.5 transition-all duration-[180ms] ease-in-out focus-visible:ring-0 focus-visible:ring-offset-0 cursor-pointer border-none",
            isExpired && "opacity-80"
          )}
          disabled={!isExpired && isLoading}
          onClick={isExpired ? handleBlockedClick : onSave}
        >
          <Save className="h-[18px] w-[18px] text-green-500 opacity-90 transition-transform duration-[180ms] ease-in-out group-hover:scale-105" strokeWidth={2.5} />
          {isLoading && !isExpired ? "Salvando..." : "Salvar"}
          {isExpired && <span className="ml-1 text-[16px]">🔒</span>}
        </Button>
      </div>
    </div>
  );
};
