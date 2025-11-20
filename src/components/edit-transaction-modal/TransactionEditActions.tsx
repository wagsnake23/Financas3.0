import React from "react";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { cn } from "@/lib/utils";

interface TransactionEditActionsProps {
  onDelete: () => void;
  onSave: () => void;
  onCancel: () => void;
  loading: boolean;
  isMobile: boolean;
  // Props de recorrência removidas
}

export const TransactionEditActions: React.FC<TransactionEditActionsProps> = ({
  onDelete,
  onSave,
  onCancel,
  loading,
  isMobile,
}) => {
  return (
    <>
      <div className={cn("flex gap-2", isMobile ? "flex-row" : "md:flex-row")}>
        <Button
          type="button"
          variant="destructive"
          onClick={onDelete}
          className={cn("flex-1 rounded-xl", isMobile && "h-9 text-xs")}
          disabled={loading}
        >
          <DynamicIcon name="Trash2" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} />
          Excluir
        </Button>
        <Button type="submit" variant="success" className={cn("flex-1 rounded-xl", isMobile && "h-9 text-xs")} disabled={loading} onClick={onSave}>
          <DynamicIcon name="CheckCircle" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} />
          {loading ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="default" onClick={onCancel} className={cn("flex-1 rounded-xl", isMobile && "h-9 text-xs")} disabled={loading}>
          <DynamicIcon name="XCircle" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} />
          Cancelar
        </Button>
      </div>
    </>
  );
};