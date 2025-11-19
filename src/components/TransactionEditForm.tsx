import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import DynamicIcon from "@/components/DynamicIcon";
import { Transaction, AppCategory, TransactionType } from "@/types/finance";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X } from "lucide-react";
import { Database, Enums, TablesUpdate } from "@/integrations/supabase/types";
import { MaterializedRecurringTransaction } from "@/hooks/useRecurringEntries";
import { CurrencyInput } from "@/components/ui/currency-input";

import { EditOptionSelector } from "./edit-installment-modal/EditOptionSelector";
import { CommonFields } from "./edit-installment-modal/CommonFields";
import { ThisMonthFields } from "./edit-installment-modal/ThisMonthFields";
import { RecurringMasterFields } from "./edit-installment-modal/RecurringMasterFields";
import { TransactionOneOffFields } from "./edit-transaction-modal/TransactionOneOffFields";
import { TransactionEditActions } from "./edit-transaction-modal/TransactionEditActions";
import { StatusToggleButton } from "./StatusToggleButton";

type ReceitaStatus = Database["public"]["Enums"]["receita_status"];
type EditOption = "thisMonth" | "thisMonthForward" | "all";

interface TransactionEditFormProps {
  editingTransaction: Transaction | null;
  onUpdateTransaction: (
    id: string,
    type: TransactionType,
    updatedTransaction: Omit<Transaction, "id">,
    editOption?: EditOption,
    preserveExceptions?: boolean,
    recurringData?:
      | TablesUpdate<"recurring_entries">
      | TablesUpdate<"recurring_entry_exceptions">
  ) => void;
  onCancelEdit: () => void;
  onDeleteTransaction: (
    id: string,
    type: TransactionType,
    isFixed?: boolean
  ) => void;
  allCategories: AppCategory[];
  isMobile: boolean;
}

const UNSELECTED_VALUE = "unselected";

export const TransactionEditForm: React.FC<TransactionEditFormProps> = ({
  editingTransaction,
  onUpdateTransaction,
  onCancelEdit,
  onDeleteTransaction,
  allCategories,
  isMobile,
}) => {
  const isRecurringTransaction = (
    editingTransaction as MaterializedRecurringTransaction
  )?.isRecurring;
  const recurringTransaction =
    editingTransaction as MaterializedRecurringTransaction;

  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [category, setCategory] = useState(UNSELECTED_VALUE);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ReceitaStatus>("Pendente");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [editOption, setEditOption] = useState<EditOption>("thisMonth");
  const [title, setTitle] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [frequency, setFrequency] =
    useState<Enums<"recurring_frequency">>("monthly");
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [recurringStatus, setRecurringStatus] =
    useState<Enums<"recurring_status">>("active");
  const [note, setNote] = useState("");
  const [overrideDueDate, setOverrideDueDate] = useState<Date | undefined>(
    undefined
  );
  const [isOverrideDueDateCalendarOpen, setIsOverrideDueDateCalendarOpen] =
    useState(false);
  const [isStartDateCalendarOpen, setIsStartDateCalendarOpen] = useState(false);
  const [isEndDateCalendarOpen, setIsEndDateCalendarOpen] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [showGlobalConfirmDialog, setShowGlobalConfirmDialog] = useState(false);
  const [preserveExceptions, setPreserveExceptions] = useState(true);

  const filteredCategories = useMemo(() => {
    const currentType = isRecurringTransaction
      ? recurringTransaction.type === "income"
        ? "receita"
        : "despesa"
      : type;
    let baseCategories: AppCategory[] = [];

    if (currentType === "receita" || currentType === "income") {
      baseCategories = allCategories.filter(
        (cat) => cat.parent_id === "receitas_e_investimentos"
      );
    } else {
      baseCategories = allCategories.filter(
        (cat) => cat.parent_id !== "receitas_e_investimentos"
      );
    }

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
    isRecurringTransaction,
    recurringTransaction,
    editingTransaction,
  ]);

  const getCategoryDisplayName = (catId: string) => {
    const category = allCategories.find((cat) => cat.id === catId);
    return category ? category.nome : catId;
  };

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

      // Default to 'thisMonth' for recurring, or no specific option for one-off
      setEditOption(isRecurringTransaction ? "thisMonth" : "thisMonth"); // Keep "thisMonth" as default for recurring
      setPreserveExceptions(true); // Default for "all" option

      if (isRecurringTransaction) {
        const recurringTrans = editingTransaction as MaterializedRecurringTransaction;
        // Initialize with materialized/exception values (for 'thisMonth' default)
        setAmount(recurringTrans.amount);
        setCategory(recurringTrans.category || UNSELECTED_VALUE);
        setOverrideDueDate(parseISO(recurringTrans.date));
        setIsPaid(recurringTrans.status === "Recebida");
        
        // Extract note from description if it's an exception
        const match = recurringTrans.description.match(/\(([^)]+)\)$/);
        setNote(match ? match[1] : "");

        // Also initialize master values (for when editOption changes later)
        setTitle(recurringTrans.recurringMasterTitle);
        setDueDay(recurringTrans.recurringMasterDueDay?.toString() || "1"); // Use recurringMasterDueDay
        setFrequency(recurringTrans.recurringMasterFrequency || "monthly");
        setStartDate(parseISO(recurringTrans.recurringMasterStartDate));
        setEndDate(
          recurringTrans.recurringMasterEndDate
            ? parseISO(recurringTrans.recurringMasterEndDate)
            : undefined
        );
        setRecurringStatus(recurringTrans.recurringMasterStatus || "active");

      } else {
        // One-off transaction initialization
        setAmount(editingTransaction.amount);
        const [year, month, day] = editingTransaction.date.split("-").map(Number);
        setDate(new Date(year, month - 1, day));
        setCategory(editingTransaction.category || UNSELECTED_VALUE);
        setIsPaid(editingTransaction.status === "Recebida");
      }
    } else {
      // Reset form when not editing
      setType("expense");
      setAmount(undefined);
      setDate(new Date());
      setCategory(UNSELECTED_VALUE);
      setDescription("");
      setStatus("Pendente");
      setTitle("");
      setDueDay("1");
      setFrequency("monthly");
      setStartDate(new Date());
      setEndDate(undefined);
      setRecurringStatus("active");
      setNote("");
      setOverrideDueDate(undefined);
      setIsPaid(false);
      setEditOption("thisMonth");
      setPreserveExceptions(true);
    }
  }, [editingTransaction, isRecurringTransaction, allCategories]);

  // Effect to re-populate fields when editOption changes for recurring transactions
  useEffect(() => {
    if (editingTransaction && isRecurringTransaction) {
      const recurringTrans = editingTransaction as MaterializedRecurringTransaction;

      if (editOption === "thisMonth") {
        // Use materialized/exception values
        setAmount(recurringTrans.amount);
        setCategory(recurringTrans.category || UNSELECTED_VALUE);
        setOverrideDueDate(parseISO(recurringTrans.date));
        setIsPaid(recurringTrans.status === "Recebida");
        const match = recurringTrans.description.match(/\(([^)]+)\)$/);
        setNote(match ? match[1] : "");
        setTitle(recurringTrans.recurringMasterTitle); // Title is hidden for thisMonth, but keep it consistent
      } else { // "thisMonthForward" or "all"
        // Use master values
        setAmount(recurringTrans.originalValue);
        setCategory(recurringTrans.originalCategory || UNSELECTED_VALUE);
        setTitle(recurringTrans.recurringMasterTitle);
        setDueDay(recurringTrans.recurringMasterDueDay?.toString() || "1");
        setFrequency(recurringTrans.recurringMasterFrequency || "monthly");
        setStartDate(parseISO(recurringTrans.recurringMasterStartDate));
        setEndDate(
          recurringTrans.recurringMasterEndDate
            ? parseISO(recurringTrans.recurringMasterEndDate)
            : undefined
        );
        setRecurringStatus(recurringTrans.recurringMasterStatus || "active");
        setNote(""); // No note for master edits
        setOverrideDueDate(undefined); // No override date for master edits
        setIsPaid(false); // Master doesn't have a 'paid' status directly, it's for occurrences
      }
    }
  }, [editOption, editingTransaction, isRecurringTransaction]); // Dependencies for this effect

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingTransaction) return;

    if (amount === undefined || amount <= 0 || category === UNSELECTED_VALUE) {
      toast.error(
        "Preencha todos os campos obrigatórios (Valor e Subcategoria)."
      );
      return;
    }

    if (isRecurringTransaction) {
      if (!title.trim()) {
        toast.error("O título do lançamento recorrente é obrigatório.");
        return;
      }

      if (parseInt(dueDay) < 1 || parseInt(dueDay) > 31) {
        toast.error("O dia de vencimento deve ser entre 1 e 31.");
        return;
      }

      if (
        (editOption === "thisMonthForward" || editOption === "all") &&
        endDate &&
        startDate &&
        endDate < startDate
      ) {
        toast.error("A data final não pode ser anterior à data inicial.");
        return;
      }

      if (editOption === "all") {
        setShowGlobalConfirmDialog(true);
        return;
      }
    }

    performUpdate();
  };
  const performUpdate = () => {
    if (!editingTransaction) return;
    setLoading(true);

    const formattedDate = date
      ? `${date.getFullYear()}-${(date.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`
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
      is_fixed: editingTransaction.is_fixed,
      recurrence_frequency: editingTransaction.recurrence_frequency,
      recurrence_installments_count:
        editingTransaction.recurrence_installments_count,
    };

    let finalRecurringPayload:
      | TablesUpdate<"recurring_entries">
      | TablesUpdate<"recurring_entry_exceptions">
      | undefined;

    if (isRecurringTransaction) {
      if (editOption === "thisMonth") {
        finalRecurringPayload = {
          override_value: amount === undefined ? null : amount,
          override_category_id: category === UNSELECTED_VALUE ? null : category,
          override_due_date: overrideDueDate
            ? format(overrideDueDate, "yyyy-MM-dd")
            : null,
          note: note.trim() || null,
          paid: isPaid,
          canceled: false,
        } as TablesUpdate<"recurring_entry_exceptions">;
      } else {
        if (editOption === "thisMonthForward") {
          const year = date!.getFullYear();
          const month = date!.getMonth() + 1;
          const newStart = new Date(year, month - 1, 1);
          setStartDate(newStart);
        }

        finalRecurringPayload = {
          title: title.trim(),
          value: amount === undefined ? null : amount,
          category_id: category === UNSELECTED_VALUE ? null : category,
          due_day: parseInt(dueDay),
          frequency,
          start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
          end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
          status: recurringStatus,
          forma_pagamento: recurringTransaction.forma_pagamento,
          cartao_id: recurringTransaction.cartao_id,
        } as TablesUpdate<"recurring_entries">;
      }
    }

    onUpdateTransaction(
      editingTransaction.id,
      type,
      updatedTransaction,
      isRecurringTransaction ? editOption : undefined,
      isRecurringTransaction && (editOption === "all" || editOption === "thisMonthForward") // Pass preserveExceptions for both "all" and "thisMonthForward"
        ? preserveExceptions
        : undefined,
      finalRecurringPayload
    );

    setLoading(false);
    setShowGlobalConfirmDialog(false);
  };

  const handleDeleteClick = () => {
    if (editingTransaction) {
      onDeleteTransaction(
        editingTransaction.id,
        editingTransaction.type,
        editingTransaction.is_fixed
      );
    }
  };

  const formContent = (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className={cn("text-2xl font-bold", isMobile && "text-xl")}>
          {isRecurringTransaction
            ? "Editar Lançamento Recorrente"
            : "Editar Lançamento"}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancelEdit}
          className={cn(isMobile && "h-8 w-8")}
        >
          <X className={cn("h-4 w-4", isMobile && "h-3.5 w-3.5")} />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isRecurringTransaction ? (
          <div className="space-y-4 py-4">
            <EditOptionSelector
              editOption={editOption}
              setEditOption={setEditOption}
              isMobile={isMobile}
              loading={loading}
            />

            <div className="space-y-4 mt-4">
              <CommonFields
                title={title}
                setTitle={setTitle}
                value={amount}
                setValue={setAmount}
                categoryId={category}
                setCategoryId={setCategory}
                filteredCategories={filteredCategories}
                getCategoryDisplayName={getCategoryDisplayName}
                loading={loading}
                isMobile={isMobile}
                hideTitle={editOption === "thisMonth"}
                categoryLabel="Subcategoria"
              />
              {editOption === "thisMonth" && (
                <ThisMonthFields
                  overrideDueDate={overrideDueDate}
                  setOverrideDueDate={setOverrideDueDate}
                  isOverrideDueDateCalendarOpen={isOverrideDueDateCalendarOpen}
                  setIsOverrideDueDateCalendarOpen={
                    setIsOverrideDueDateCalendarOpen
                  }
                  note={note}
                  setNote={setNote}
                  isPaid={isPaid}
                  setIsPaid={setIsPaid}
                  loading={loading}
                  isMobile={isMobile}
                  transactionType={type}
                  currentTransactionStatus={
                    editingTransaction?.status || "Pendente"
                  }
                />
              )}

              {editOption !== "thisMonth" && (
                <RecurringMasterFields
                  dueDay={dueDay}
                  setDueDay={setDueDay}
                  frequency={frequency}
                  setFrequency={setFrequency}
                  startDate={startDate}
                  setStartDate={setStartDate}
                  isStartDateCalendarOpen={isStartDateCalendarOpen}
                  setIsStartDateCalendarOpen={setIsStartDateCalendarOpen}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  isEndDateCalendarOpen={isEndDateCalendarOpen}
                  setIsEndDateCalendarOpen={setIsEndDateCalendarOpen}
                  status={recurringStatus}
                  setStatus={setRecurringStatus}
                  loading={loading}
                  isMobile={isMobile}
                  showStartDate={editOption === "all"}
                  showPreserveExceptions={editOption === "all" || editOption === "thisMonthForward"} // Show for both "all" and "thisMonthForward"
                  preserveExceptions={preserveExceptions}
                  setPreserveExceptions={setPreserveExceptions}
                />
              )}
            </div>
          </div>
        ) : (
          <TransactionOneOffFields
            amount={amount}
            setAmount={setAmount}
            date={date}
            setDate={setDate}
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
            isFixedLegacy={editingTransaction?.is_fixed}
            transactionType={type}
            UNSELECTED_VALUE={UNSELECTED_VALUE}
            isPaid={isPaid}
            setIsPaid={setIsPaid}
          />
        )}

        <TransactionEditActions
          onDelete={handleDeleteClick}
          onSave={handleSubmit}
          onCancel={onCancelEdit}
          loading={loading}
          isMobile={isMobile}
          showGlobalConfirmDialog={showGlobalConfirmDialog}
          setShowGlobalConfirmDialog={setShowGlobalConfirmDialog}
          performUpdate={performUpdate}
          isRecurringTransaction={isRecurringTransaction}
          editOption={editOption}
          preserveExceptions={preserveExceptions}
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