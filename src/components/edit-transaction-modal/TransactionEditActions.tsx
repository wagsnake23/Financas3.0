import React from "react";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TransactionEditActionsProps {
  onDelete: () => void;
  onSave: () => void; // Renomeado para onSave para ser mais genérico
  onCancel: () => void;
  loading: boolean;
  isMobile: boolean;
  showGlobalConfirmDialog: boolean;
  setShowGlobalConfirmDialog: (open: boolean) => void;
  performUpdate: () => void; // Função para executar a atualização após a confirmação
  isRecurringTransaction: boolean;
  editOption: "thisMonth" | "thisMonthForward" | "all";
  preserveExceptions: boolean;
}

export const TransactionEditActions: React.FC<TransactionEditActionsProps> = ({
  onDelete,
  onSave,
  onCancel,
  loading,
  isMobile,
  showGlobalConfirmDialog,
  setShowGlobalConfirmDialog,
  performUpdate,
  isRecurringTransaction,
  editOption,
  preserveExceptions,
}) => {
  return (
    <>
      <div className={cn("flex gap-2", isMobile ? "flex-row" : "md:flex-row")}> {/* Alterado para flex-row em mobile */}
        <Button
          type="button"
          variant="destructive"
          onClick={onDelete}
          className={cn("flex-1 rounded-xl", isMobile && "h-9 text-xs")} // Adicionado flex-1 e ajustado tamanho para mobile
          disabled={loading}
        >
          <DynamicIcon name="Trash2" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} /> {/* Ajustado ícone para mobile */}
          Excluir
        </Button>
        <Button type="submit" variant="success" className={cn("flex-1 rounded-xl", isMobile && "h-9 text-xs")} disabled={loading} onClick={onSave}> {/* Adicionado flex-1 e ajustado tamanho para mobile */}
          <DynamicIcon name="CheckCircle" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} /> {/* Ajustado ícone para mobile */}
          {loading ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="default" onClick={onCancel} className={cn("flex-1 rounded-xl", isMobile && "h-9 text-xs")} disabled={loading}> {/* Adicionado flex-1 e ajustado tamanho para mobile */}
          <DynamicIcon name="XCircle" className={cn("mr-1 h-3.5 w-3.5", isMobile && "h-3 w-3 mr-0.5")} /> {/* Ajustado ícone para mobile */}
          Cancelar
        </Button>
      </div>

      {/* AlertDialog for Global Recurring Update Confirmation */}
      {isRecurringTransaction && editOption === "all" && (
        <AlertDialog open={showGlobalConfirmDialog} onOpenChange={setShowGlobalConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Alteração Global?</AlertDialogTitle>
              <AlertDialogDescription>
                Você está prestes a alterar **toda a recorrência** deste lançamento.
                {preserveExceptions ? (
                  " As exceções existentes serão mantidas."
                ) : (
                  " Todas as exceções existentes serão **removidas**."
                )}
                Esta ação não pode ser desfeita facilmente. Tem certeza que deseja continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading} onClick={() => setShowGlobalConfirmDialog(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={performUpdate} disabled={loading}>
                {loading ? "Confirmando..." : "Confirmar e Salvar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
};