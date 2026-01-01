import React from "react";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { cn } from "@/lib/utils";

interface TransactionEditActionsProps {
  onTriggerDeleteConfirmation: () => void; // Nova prop para acionar o diálogo
  onSave: (e?: React.FormEvent) => void;
  onCancel: () => void;
  loading: boolean;
  isMobile: boolean;
  isRecurringTransaction: boolean; // Nova prop para indicar se é transação recorrente
  className?: string; // Adicionado className para receber classes externas
}

export const TransactionEditActions: React.FC<TransactionEditActionsProps> = ({
  onTriggerDeleteConfirmation,
  onSave,
  onCancel,
  loading,
  isMobile,
  isRecurringTransaction,
  className, // Receber a prop className
}) => {
  return (
    <div className={cn("flex gap-3 px-6 pb-6 pt-2", isMobile ? "action-buttons" : "md:flex-row", className)}> {/* Aplicado className aqui */}
      <Button
        type="button"
        onClick={onTriggerDeleteConfirmation} // Chama a nova prop
        className={cn(
          "flex-1 rounded-2xl bg-[#FFF5F5] text-[#FF4D4D] border border-[#FFD6D6] hover:bg-[#FF4D4D] hover:text-white transition-all duration-300 shadow-sm",
          "text-sm font-semibold",
          isMobile && "h-12"
        )}
        disabled={loading}
      >
        <DynamicIcon name="Trash2" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} />
        Excluir
      </Button>
      <Button
        type="button" // Alterado para type="button" para que o onClick do formulário controle o submit
        onClick={onCancel}
        className={cn(
          "flex-1 rounded-2xl bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0] hover:bg-[#64748B] hover:text-white transition-all duration-300 shadow-sm",
          "text-sm font-semibold",
          isMobile && "h-12"
        )}
        disabled={loading}
      >
        <DynamicIcon name="XCircle" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} />
        Cancelar
      </Button>
      <Button
        type="submit" // Mantido como type="submit"
        className={cn(
          "flex-1 rounded-2xl bg-[#F0FDF4] text-[#22C55E] border border-[#BBF7D0] hover:bg-[#22C55E] hover:text-white transition-all duration-300 shadow-sm",
          "text-sm font-semibold",
          isMobile && "h-12"
        )}
        disabled={loading}
        onClick={onSave}
      >
        <DynamicIcon name="CheckCircle" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} />
        {loading ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
};