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
    <div className={cn("flex gap-2", isMobile ? "action-buttons" : "md:flex-row", className)}> {/* Aplicado className aqui */}
      <Button
        type="button"
        onClick={onTriggerDeleteConfirmation} // Chama a nova prop
        className={cn(
          "flex-1 rounded-xl border border-red-100 bg-white text-red-600 hover:bg-red-50 hover:text-red-700 font-bold transition-colors",
          "text-sm",
          isMobile && "h-9"
        )}
        disabled={loading}
      >
        Excluir
      </Button>
      <Button
        type="button" // Alterado para type="button" para que o onClick do formulário controle o submit
        onClick={onCancel}
        className={cn(
          "flex-1 rounded-xl border border-blue-100 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-bold transition-colors",
          "text-sm", // Aumenta a fonte para 'sm'
          isMobile && "h-9" // Mantém a altura para mobile
        )}
        disabled={loading}
      >
        Cancelar
      </Button>
      <Button
        type="submit" // Mantido como type="submit"
        className={cn(
          "flex-1 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 border-transparent shadow-md transition-all hover:shadow-lg", // Verde moderno um pouco mais claro
          "text-sm", // Aumenta a fonte para 'sm'
          isMobile && "h-9" // Mantém a altura para mobile
        )}
        disabled={loading}
        onClick={onSave}
      >
        {loading ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
};