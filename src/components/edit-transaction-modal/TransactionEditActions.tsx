import React from "react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import DynamicIcon from "@/components/DynamicIcon";
import { cn } from "@/lib/utils";
import { Lock, Save, Trash, Trash2 } from "lucide-react";

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
    <div className={cn("grid grid-cols-2 gap-2 w-full pt-1", className)}>
      <Button
        type="button"
        onClick={onTriggerDeleteConfirmation}
        className="w-full rounded-[14px] font-extrabold tracking-[0.2px] border border-red-200 transition-all active:scale-95 text-[18px] h-[44px] flex items-center justify-center gap-[6px] bg-red-50 text-red-500 hover:bg-red-100"
        disabled={isLoading}
      >
        <Trash2 className="w-[18px] h-[18px]" strokeWidth={2.5} />
        Excluir
      </Button>

      <Button
        type={isExpired ? "button" : "submit"}
        className={cn(
          "w-full rounded-[14px] font-extrabold tracking-[0.2px] text-white border-none transition-all active:scale-95 text-[18px] h-[44px] flex items-center justify-center gap-[6px] bg-[#1AA361] hover:bg-[#158C52]",
          isExpired && "opacity-80"
        )}
        disabled={!isExpired && isLoading}
        onClick={isExpired ? handleBlockedClick : onSave}
      >
        {isLoading && !isExpired ? "Salvando..." : (
          <>
            <Save className="w-[18px] h-[18px]" strokeWidth={2.5} />
            Salvar
          </>
        )}
        {isExpired && <span className="ml-1 text-[16px]">🔒</span>}
      </Button>
    </div>
  );
};
