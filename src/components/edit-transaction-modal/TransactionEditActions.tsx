import React from "react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import DynamicIcon from "@/components/DynamicIcon";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

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
    <div className={cn("grid grid-cols-3 gap-2", className)}> {/* Grid layout for equal widths */}
      <Button
        type="button"
        onClick={onTriggerDeleteConfirmation} // Chama a nova prop
        className={cn(
          "w-full rounded-[14px] btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11"
        )}
        style={{ "--cor-topo": "#EF5A5A", "--cor-base": "#E54D4D" } as any}
        disabled={isLoading}
      >
        Excluir
      </Button>
      <Button
        type="button" // Alterado para type="button" para que o onClick do formulário controle o submit
        onClick={onCancel}
        className={cn(
          "w-full rounded-[14px] btn-3d font-black !text-slate-700 border border-slate-300 transition-all active:scale-95 text-[16px] h-11"
        )}
        style={{
          "--cor-topo": "#E2E8F0",
          "--cor-base": "#CBD5E1",
          boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), inset 0px -1px 0px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0,0,0,0.05)"
        } as any}
        disabled={isLoading}
      >
        Cancelar
      </Button>
      <Button
        type={isExpired ? "button" : "submit"}
        className={cn(
          "w-full rounded-[14px] btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
          isExpired && "opacity-80"
        )}
        style={{ "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any}
        disabled={!isExpired && isLoading}
        onClick={isExpired ? handleBlockedClick : onSave}
      >
        {isLoading && !isExpired ? "Salvando..." : "Salvar"}
        {isExpired && <span className="ml-1.5 text-base">🔒</span>}
      </Button>
    </div>
  );
};