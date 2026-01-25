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
    <div className={cn("grid grid-cols-3 gap-2", className)}> {/* Grid layout for equal widths */}
      <Button
        type="button"
        onClick={onTriggerDeleteConfirmation} // Chama a nova prop
        className={cn(
          "w-full rounded-2xl border border-red-100 bg-white text-red-600 hover:bg-red-50 hover:text-red-700 font-black transition-colors",
          "text-[17px] h-12"
        )}
        disabled={loading}
      >
        Excluir
      </Button>
      <Button
        type="button" // Alterado para type="button" para que o onClick do formulário controle o submit
        onClick={onCancel}
        className={cn(
          "w-full rounded-2xl border border-blue-200 bg-white text-[#1A56AD] hover:bg-blue-50 hover:text-[#1A56AD]/80 font-black transition-colors",
          "text-[17px] h-12"
        )}
        disabled={loading}
      >
        Cancelar
      </Button>
      <Button
        type="submit" // Mantido como type="submit"
        className={cn(
          "w-full rounded-2xl bg-[#25D366] text-white hover:bg-[#25D366]/90 border-transparent shadow-md transition-all hover:shadow-lg",
          "text-[17px] font-black h-12"
        )}
        disabled={loading}
        onClick={onSave}
      >
        {loading ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
};