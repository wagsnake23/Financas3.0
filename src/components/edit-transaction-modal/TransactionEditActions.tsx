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
          "group flex-1 h-11 rounded-2xl bg-white text-red-500 hover:text-red-600 border border-slate-300 hover:bg-slate-50 active:bg-slate-100 font-black transition-all active:scale-95 text-[16px] flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_1px_2px_rgba(15,23,42,0.03),inset_0_-1px_0_rgba(15,23,42,0.03)]"
        )}
        disabled={isLoading}
      >
        <Trash className="h-[18px] w-[18px] text-red-500 group-hover:text-red-600 opacity-90 transition-transform duration-[180ms] ease-out group-hover:scale-105" strokeWidth={2.5} />
        Excluir
      </Button>

      <Button
        type={isExpired ? "button" : "submit"}
        className={cn(
          "group flex-1 h-11 rounded-2xl font-black tracking-[0.5px] text-white border-none transition-all active:scale-95 text-[16px] flex items-center justify-center gap-1.5 btn-3d cursor-pointer !shadow-[inset_0_1px_2px_rgba(255,255,255,0.15),0_1px_3px_rgba(15,23,42,0.04)] hover:!shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_2px_4px_rgba(15,23,42,0.05)] active:!shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]",
          isExpired && "opacity-80"
        )}
        style={{ "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any}
        disabled={!isExpired && isLoading}
        onClick={isExpired ? handleBlockedClick : onSave}
      >
        <Save className="h-[18px] w-[18px] text-white opacity-90 transition-transform duration-[180ms] ease-out group-hover:scale-105" strokeWidth={2.5} />
        {isLoading && !isExpired ? "Salvando..." : "Salvar"}
        {isExpired && <span className="ml-1 text-[16px]">🔒</span>}
      </Button>
    </div>
  );
};
