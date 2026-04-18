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
          "w-full rounded-[14px] font-black text-[#dc2626] border border-[#fecaca] bg-[#fef2f2] transition-all active:scale-95 shadow-[0_1px_2px_rgba(0,0,0,0.05)] text-[16px] h-11 hover:bg-[#fee2e2]"
        )}
        disabled={loading}
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
        disabled={loading}
      >
        Cancelar
      </Button>
      <Button
        type="submit" // Mantido como type="submit"
        className={cn(
          "w-full rounded-[14px] btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11"
        )}
        style={{ "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any}
        disabled={loading}
        onClick={onSave}
      >
        {loading ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
};