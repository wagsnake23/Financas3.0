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
import { useAuth } from "@/hooks/useAuth";
import { useRecurringEntries, MaterializedRecurringTransaction } from "@/hooks/useRecurringEntries";
import { format, subMonths } from "date-fns";
import { AppCategory } from "@/types/finance"; // Importar AppCategory

interface DeleteRecurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: MaterializedRecurringTransaction | null;
  isMobile: boolean;
  fetchedCategories: AppCategory[]; // Adicionado para receber as categorias
}

type DeleteOption = "thisMonth" | "thisMonthForward" | "all";

export const DeleteRecurrenceModal: React.FC<DeleteRecurrenceModalProps> = ({
  isOpen,
  onClose,
  transaction,
  isMobile,
  fetchedCategories, // Recebendo as categorias
}) => {
  const { user } = useAuth();
  const {
    cancelMonth,
    endRecurringAt,
    deleteRecurringEntry,
  } = useRecurringEntries(user, new Date(), fetchedCategories); // Passando fetchedCategories

  const [deleteOption, setDeleteOption] = useState<DeleteOption>("thisMonth");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDeleteOption("thisMonth"); // Reset to default when closing
    }
  }, [isOpen]);

  const handleDelete = async () => {
    if (!user || !transaction) { // ADDED USER CHECK
      toast.error("Usuário não autenticado. Por favor, faça login novamente.");
      return;
    }
    setLoading(true);

    try {
      const currentYear = new Date(transaction.date).getFullYear();
      const currentMonth = new Date(transaction.date).getMonth() + 1;

      if (deleteOption === "thisMonth") {
        await cancelMonth({
          recurring_id: transaction.recurringEntryId,
          year: currentYear,
          month: currentMonth,
        });
      } else if (deleteOption === "thisMonthForward") {
        // End the recurring entry at the end of the previous month
        const previousMonthDate = subMonths(new Date(transaction.date), 1);
        await endRecurringAt({
          recurring_id: transaction.recurringEntryId,
          end_year: previousMonthDate.getFullYear(),
          end_month: previousMonthDate.getMonth() + 1,
        });
      } else if (deleteOption === "all") {
        await deleteRecurringEntry(transaction.recurringEntryId);
      }
      onClose();
    } catch (error) {
      // Error handled by mutation's onError
    } finally {
      setLoading(false);
    }
  };

  if (!transaction) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className={cn("sm:max-w-[500px]", isMobile && "max-w-[90vw] rounded-lg")}>
        <AlertDialogHeader>
          <AlertDialogTitle className={cn(isMobile && "text-lg")}>Excluir Lançamento Recorrente</AlertDialogTitle>
          <AlertDialogDescription className={cn(isMobile && "text-sm")}>
            Selecione como você deseja excluir este lançamento recorrente.
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
              <span className="block w-full text-center font-normal text-sm">Somente este mês</span>
            </Label>
            <Label
              htmlFor="d2"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-destructive"
            >
              <RadioGroupItem value="thisMonthForward" id="d2" className="sr-only" />
              <DynamicIcon name="ArrowDown" className="mb-3 h-6 w-6" />
              <span className="block w-full text-center font-normal text-sm">Deste mês em diante</span>
            </Label>
            <Label
              htmlFor="d3"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-destructive"
            >
              <RadioGroupItem value="all" id="d3" className="sr-only" />
              <DynamicIcon name="Trash2" className="mb-3 h-6 w-6" />
              <span className="block w-full text-center font-normal text-sm">Toda a recorrência</span>
            </Label>
          </RadioGroup>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={loading}>
            <DynamicIcon name="Trash2" className={cn("mr-2 h-4 w-4", isMobile && "h-3.5 w-3.5")} />
            {loading ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};