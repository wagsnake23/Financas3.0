import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import DynamicIcon from "@/components/DynamicIcon";
import { Transaction, AppCategory, TransactionType } from "@/types/finance";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Importar RadioGroup

import { TransactionOneOffFields } from "./edit-transaction-modal/TransactionOneOffFields";
import { TransactionEditActions } from "./edit-transaction-modal/TransactionEditActions";

type ReceitaStatus = Database["public"]["Enums"]["receita_status"];
type DeleteScope = "thisMonth" | "thisMonthForward" | "all" | "oneOff"; // 'oneOff' para transações avulsas

interface TransactionEditFormProps {
  editingTransaction: Transaction | null;
  onUpdateTransaction: (
    id: string,
    type: TransactionType,
    updatedTransaction: Omit<Transaction, "id">
  ) => void;
  onCancelEdit: () => void;
  onDeleteTransaction: (
    id: string,
    type: TransactionType,
    deleteScope: DeleteScope // Adicionado deleteScope
  ) => void;
  allCategories: AppCategory[];
  isMobile: boolean;
}

const UNSELECTED_VALUE = "unselected";

// Helper function to create a local Date object from a YYYY-MM-DD string
const createSafeDate = (dateString: string | null | undefined): Date | undefined => {
  if (!dateString) return undefined;
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const TransactionEditForm: React.FC<TransactionEditFormProps> = ({
  editingTransaction,
  onUpdateTransaction,
  onCancelEdit,
  onDeleteTransaction,
  allCategories,
  isMobile,
}) => {
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [category, setCategory] = useState(UNSELECTED_VALUE);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ReceitaStatus>("Pendente");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  // Estados para o diálogo de exclusão
  const [showDeleteOptionsDialog, setShowDeleteOptionsDialog] = useState(false);
  const [showSimpleDeleteDialog, setShowSimpleDeleteDialog] = useState(false);
  const [selectedDeleteScope, setSelectedDeleteScope] = useState<DeleteScope>("thisMonth"); // Novo estado para o radio button

  const isRecurringTransaction = useMemo(() => {
    return editingTransaction?.type === "expense" && 
           !!editingTransaction.despesa_id && 
           (editingTransaction.totalInstallments || 0) > 1;
  }, [editingTransaction]);

  const filteredCategories = useMemo(() => {
    let baseCategories: AppCategory[] = [];

    if (type === "income") {
      baseCategories = allCategories.filter(
        (cat) => cat.parent_id === "receitas_e_investimentos"
      );
    } else {
      baseCategories = allCategories.filter(
        (cat) => cat.parent_id !== "receitas_e_investimentos"
      );
    }

    // Ensure the current category is always available in the dropdown if it's not in the filtered list
    if (
      editingTransaction &&
      editingTransaction.category &&
      !baseCategories.some((cat) => cat.id === editingTransaction.category)
    ) {
      const currentCategory = allCategories.find(
        (cat) => cat.id === editingTransaction.category
      );
      if (currentCategory)
        baseCategories = [currentCategory, ...baseCategories];
    }

    return baseCategories;
  }, [
    type,
    allCategories,
    editingTransaction,
  ]);

  // Effect to initialize form fields when editingTransaction changes
  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setDescription(editingTransaction.description || "");

      const validStatuses: ReceitaStatus[] = [
        "Prevista",
        "Pendente",
        "Recebida",
        "Cancelada",
      ];
      const initialStatus =
        editingTransaction.status &&
        validStatuses.includes(editingTransaction.status)
          ? editingTransaction.status
          : "Pendente";
      setStatus(initialStatus);
      
      setAmount(editingTransaction.amount);
      setDate(createSafeDate(editingTransaction.date)); // Use createSafeDate
      setCategory(editingTransaction.category || UNSELECTED_VALUE);
      setIsPaid(editingTransaction.status === "Recebida");
    } else {
      // Reset form when not editing
      setType("expense");
      setAmount(undefined);
      setDate(new Date());
      setCategory(UNSELECTED_VALUE);
      setDescription("");
      setStatus("Pendente");
      setIsPaid(false);
    }
  }, [editingTransaction, allCategories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performUpdate();
  };

  const performUpdate = () => {
    if (!editingTransaction) return;
    setLoading(true);

    if (amount === undefined || amount <= 0 || category === UNSELECTED_VALUE) {
      toast.error(
        "Preencha todos os campos obrigatórios (Valor e Subcategoria)."
      );
      setLoading(false);
      return;
    }

    // Formatar a data como string YYYY-MM-DD (local)
    const formattedDate = date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      : "";

    let finalStatus: ReceitaStatus = isPaid
      ? "Recebida"
      : editingTransaction.status === "Cancelada"
      ? "Cancelada"
      : editingTransaction.status === "Prevista"
      ? "Prevista"
      : "Pendente";

    const updatedTransaction: Omit<Transaction, "id"> = {
      type,
      amount: amount as number,
      date: formattedDate,
      category: category === UNSELECTED_VALUE ? null : category,
      description,
      status: finalStatus,
      // Keep installment-related fields for one-off installment expenses
      installmentNumber: editingTransaction.installmentNumber,
      totalInstallments: editingTransaction.totalInstallments,
      forma_pagamento: editingTransaction.forma_pagamento,
      cartao_id: editingTransaction.cartao_id,
      despesa_id: editingTransaction.despesa_id,
    };

    onUpdateTransaction(
      editingTransaction.id,
      type,
      updatedTransaction
    );

    setLoading(false);
  };

  const handleTriggerDeleteConfirmation = () => {
    if (!editingTransaction) return;

    if (isRecurringTransaction) {
      setShowDeleteOptionsDialog(true);
    } else {
      setShowSimpleDeleteDialog(true);
    }
  };

  const handleConfirmDelete = (deleteScope: DeleteScope) => {
    if (editingTransaction) {
      onDeleteTransaction(
        editingTransaction.id,
        editingTransaction.type,
        deleteScope
      );
    }
    setShowDeleteOptionsDialog(false);
    setShowSimpleDeleteDialog(false);
  };

  const formContent = (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TransactionOneOffFields
          amount={amount}
          setAmount={setAmount}
          date={date}
          setDate={(date) => {
            if (!date) return;
            const fixedDate = new Date(
              date.getFullYear(),
              date.getMonth(),
              date.getDate()
            );
            setDate(fixedDate);
          }}
          category={category}
          setCategory={setCategory}
          description={description}
          setDescription={setDescription}
          status={status}
          setStatus={setStatus}
          isCalendarOpen={isCalendarOpen}
          setIsCalendarOpen={setIsCalendarOpen}
          filteredCategories={filteredCategories}
          isMobile={isMobile}
          transactionType={type}
          UNSELECTED_VALUE={UNSELECTED_VALUE}
          isPaid={isPaid}
          setIsPaid={setIsPaid}
        />

        <TransactionEditActions
          onTriggerDeleteConfirmation={handleTriggerDeleteConfirmation} // Novo prop
          onSave={handleSubmit}
          onCancel={onCancelEdit}
          loading={loading}
          isMobile={isMobile}
          isRecurringTransaction={isRecurringTransaction} // Passar para o componente de ações
        />
      </form>

      {/* Diálogo de Confirmação para Exclusão de Despesa Avulsa */}
      <AlertDialog open={showSimpleDeleteDialog} onOpenChange={setShowSimpleDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmDelete("oneOff")} disabled={loading}>
              {loading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Confirmação para Exclusão de Despesa Parcelada */}
      <AlertDialog open={showDeleteOptionsDialog} onOpenChange={setShowDeleteOptionsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
              Excluir Despesa Parcelada
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta despesa faz parte de um lançamento parcelado. Como você gostaria de excluí-la?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <RadioGroup
              value={selectedDeleteScope}
              onValueChange={(value: DeleteScope) => setSelectedDeleteScope(value)}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="thisMonth" id="delete-this-month" />
                <label htmlFor="delete-this-month" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Apenas este mês
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="thisMonthForward" id="delete-this-month-forward" />
                <label htmlFor="delete-this-month-forward" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Deste mês em diante
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="all" id="delete-all" />
                <label htmlFor="delete-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Todo o período
                </label>
              </div>
            </RadioGroup>
          </div>
          <AlertDialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel disabled={loading} className="w-full sm:w-auto mt-2 sm:mt-0">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmDelete(selectedDeleteScope)} disabled={loading} className="w-full sm:w-auto">
              {loading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return isMobile ? (
    <div className={cn("p-4", isMobile && "p-0")}>{formContent}</div>
  ) : (
    <Card className={cn("p-6 animate-fade-in rounded-xl shadow-sm")}>
      {formContent}
    </Card>
  );
};