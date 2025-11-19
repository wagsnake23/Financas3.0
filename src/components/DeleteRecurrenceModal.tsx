import React, { useState, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { Transaction } from "@/types/finance"; // Importar Transaction

interface DeleteRecurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null; // Alterado o tipo para Transaction
  isMobile: boolean;
  // fetchedCategories: AppCategory[]; // Removido, pois useRecurringEntries não é mais usado aqui
  onConfirmDeleteWithOptions: (transaction: Transaction, deleteOption: "thisMonth" | "thisMonthForward" | "all") => Promise<void>; // Nova prop
}

type DeleteOption = "thisMonth" | "thisMonthForward" | "all";

export const DeleteRecurrenceModal: React.FC<DeleteRecurrenceModalProps> = ({
  isOpen,
  onClose,
  transaction,
  isMobile,
  // fetchedCategories, // Removido
  onConfirmDeleteWithOptions, // Nova prop
}) => {
  const [deleteOption, setDeleteOption] = useState<DeleteOption>("thisMonth");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDeleteOption("thisMonth"); // Reset para o padrão ao fechar
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!transaction) return;
    setLoading(true);
    try {
      await onConfirmDeleteWithOptions(transaction, deleteOption);
      // onClose será chamado por useLancamentosLogic após a exclusão bem-sucedida
    } catch (error) {
      // O erro já é tratado por onConfirmDeleteWithOptions
    } finally {
      setLoading(false);
    }
  };

  if (!transaction) return null;

  // Ajustar título e descrição com base no tipo de transação
  const isRecurringEntry = transaction.isRecurring;
  const isInstallmentExpense = transaction.type === "expense" && transaction.installmentNumber && transaction.totalInstallments && transaction.totalInstallments > 1;

  const dialogTitle = isRecurringEntry ? "Excluir Lançamento Recorrente" :
                      isInstallmentExpense ? "Excluir Despesa Parcelada" :
                      "Excluir Lançamento"; // Fallback, embora não deva ser atingido

  const dialogDescription = isRecurringEntry ? "Selecione como você deseja excluir este lançamento recorrente." :
                            isInstallmentExpense ? "Selecione como você deseja excluir esta despesa parcelada." :
                            "Selecione como você deseja excluir este lançamento."; // Fallback

  const option1Label = isRecurringEntry ? "Somente este mês" : "Somente esta parcela";
  const option2Label = isRecurringEntry ? "Deste mês em diante" : "Deste mês em diante";
  const option3Label = isRecurringEntry ? "Toda a recorrência" : "Toda a despesa parcelada";

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className={cn("sm:max-w-[500px]", isMobile && "max-w-[90vw] rounded-lg")}>
        <AlertDialogHeader>
          <AlertDialogTitle className={cn(isMobile && "text-lg")}>{dialogTitle}</AlertDialogTitle>
          <AlertDialogDescription className={cn(isMobile && "text-sm")}>
            {dialogDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
          <RadioGroup value={deleteOption} onValueChange={(value: DeleteOption) => setDeleteOption(value)} className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Label
              htmlFor="d1"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-destructive"
            >
              <RadioGroupItem value="thisMonth" id="d1" className="sr-only" />
              <DynamicIcon name="CalendarOff" className="mb-3 h-6 w-6" />
              <span className="block w-full text-center font-normal text-sm">{option1Label}</span>
            </Label>
            <Label
              htmlFor="d2"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-destructive"
            >
              <RadioGroupItem value="thisMonthForward" id="d2" className="sr-only" />
              <DynamicIcon name="ArrowDown" className="mb-3 h-6 w-6" />
              <span className="block w-full text-center font-normal text-sm">{option2Label}</span>
            </Label>
            <Label
              htmlFor="d3"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-destructive"
            >
              <RadioGroupItem value="all" id="d3" className="sr-only" />
              <DynamicIcon name="Trash2" className="mb-3 h-6 w-6" />
              <span className="block w-full text-center font-normal text-sm">{option3Label}</span>
            </Label>
          </RadioGroup>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading}>
            <DynamicIcon name="Trash2" className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
            {loading ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};