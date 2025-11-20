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

import { TransactionOneOffFields } from "./edit-transaction-modal/TransactionOneOffFields";
import { TransactionEditActions } from "./edit-transaction-modal/TransactionEditActions";

type ReceitaStatus = Database["public"]["Enums"]["receita_status"];

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
    type: TransactionType
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

  const handleDeleteClick = () => {
    if (editingTransaction) {
      onDeleteTransaction(
        editingTransaction.id,
        editingTransaction.type
      );
    }
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
          onDelete={handleDeleteClick}
          onSave={handleSubmit}
          onCancel={onCancelEdit}
          loading={loading}
          isMobile={isMobile}
          showGlobalConfirmDialog={false} // Always false now
          setShowGlobalConfirmDialog={() => {}} // No-op
          performUpdate={performUpdate}
          isRecurringTransaction={false} // Always false now
          editOption="thisMonth" // Default, not used
          preserveExceptions={false} // Default, not used
        />
      </form>
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