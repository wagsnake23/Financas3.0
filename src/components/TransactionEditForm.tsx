import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Transaction, TransactionType, AppCategory } from "@/types/finance";
import { toast } from "sonner";
import DynamicIcon from "./DynamicIcon";
import { cn, isValidUuid, getBorderClass } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X } from "lucide-react";
import { Database, Tables } from "@/integrations/supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
}
  from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";

import { useTransactionEditForm } from "@/hooks/useTransactionEditForm"; // Importar o novo hook
import { TransactionDetailsFields } from "./edit-transaction-modal/TransactionDetailsFields"; // Importar o novo componente
import { TransactionDeleteDialogs } from "./edit-transaction-modal/TransactionDeleteDialogs"; // Importar o novo componente
import { TransactionSaveDialogs } from "./edit-transaction-modal/TransactionSaveDialogs"; // Importar o novo componente
import { TransactionEditActions } from "./edit-transaction-modal/TransactionEditActions";
import { TransactionStatusBar } from "./edit-transaction-modal/TransactionStatusBar";

type ReceitaStatus = Database["public"]["Enums"]["receita_status"];
type DeleteScope = "thisMonth" | "thisMonthForward" | "oneOff";
type SaveScope = "thisMonth" | "thisMonthForward" | "oneOff";

interface TransactionEditFormProps {
  editingTransaction: Transaction | null;
  onUpdateTransaction: (
    id: string,
    type: TransactionType,
    updatedTransaction: Omit<Transaction, "id">,
    saveScope: SaveScope
  ) => void;
  onCancelEdit: () => void;
  onDeleteTransaction: (
    id: string,
    type: TransactionType,
    deleteScope: DeleteScope
  ) => void;
  allCategories: AppCategory[];
  cartoes: Tables<"cartoes">[];
  refetchCartoes: () => void;
  isMobile: boolean;
}

const UNSELECTED_VALUE = "unselected";

export const TransactionEditForm: React.FC<TransactionEditFormProps> = ({
  editingTransaction,
  onUpdateTransaction,
  onCancelEdit,
  onDeleteTransaction,
  allCategories,
  cartoes,
  refetchCartoes,
  isMobile,
}) => {
  const {
    type,
    setType,
    amount,
    setAmount,
    date,
    setDate,
    category,
    setCategory,
    description,
    setDescription,
    status,
    setStatus,
    isCalendarOpen,
    setIsCalendarOpen,
    loading,
    setLoading,
    isPaid,
    setIsPaid,
    validationErrors,
    setValidationErrors,
    paidAtTimestamp,
    setPaidAtTimestamp,
    formaPagamento,
    setFormaPagamento,
    cartaoId,
    setCartaoId,
    showDeleteOptionsDialog,
    setShowDeleteOptionsDialog,
    showSimpleDeleteDialog,
    setShowSimpleDeleteOptionsDialog, // Corrected name
    selectedDeleteScope,
    setSelectedDeleteScope,
    showSaveOptionsDialog,
    setShowSaveOptionsDialog,
    selectedSaveScope,
    setSelectedSaveScope,
    pendingFutureItemsCount,
    isFetchingOptions,
    isDeleting,
    isRecurringTransaction,
    filteredCategories,
    handleSubmit,
    handleConfirmSave,
    handleTriggerDeleteConfirmation,
    handleConfirmDelete,
    UNSELECTED_VALUE: hookUnselectedValue, // Renomear para evitar conflito
    createSafeDate, // Usar a função do hook
  } = useTransactionEditForm({
    editingTransaction,
    onUpdateTransaction,
    onCancelEdit,
    onDeleteTransaction,
    allCategories,
    cartoes,
    refetchCartoes,
  });

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className={cn(
          "flex flex-col",
          isMobile && "max-h-[70vh] overflow-hidden"
        )}
      >
        <TransactionStatusBar
          isPaid={isPaid}
          setIsPaid={setIsPaid}
          paidAtTimestamp={paidAtTimestamp}
          setPaidAtTimestamp={setPaidAtTimestamp}
          transactionType={type as "income" | "expense"}
          isMobile={isMobile}
        />
        <div
          className={cn(
            "overflow-y-auto flex-1 min-h-0 pb-1",
            isMobile ? "w-full px-2 mt-0 overflow-x-hidden" : "px-3"
          )}
        >
          <TransactionDetailsFields
            amount={amount}
            setAmount={setAmount}
            date={date}
            setDate={setDate}
            category={category}
            setCategory={setCategory}
            description={description}
            setDescription={setDescription}
            isCalendarOpen={isCalendarOpen}
            setIsCalendarOpen={setIsCalendarOpen}
            filteredCategories={filteredCategories}
            isMobile={isMobile}
            transactionType={type}
            UNSELECTED_VALUE={hookUnselectedValue}
            isPaid={isPaid}
            setIsPaid={setIsPaid}
            installmentNumber={editingTransaction?.installmentNumber}
            totalInstallments={editingTransaction?.totalInstallments}
            tipoPagamento={editingTransaction?.tipo_pagamento}
            validationErrors={validationErrors}
            setValidationErrors={setValidationErrors}
            paidAtTimestamp={paidAtTimestamp}
            formaPagamento={formaPagamento}
            setFormaPagamento={setFormaPagamento}
            cartaoId={cartaoId}
            setCartaoId={setCartaoId}
            cartoes={cartoes}
            refetchCartoes={refetchCartoes}
            isRecurringTransaction={isRecurringTransaction}
          />
        </div>

        <TransactionEditActions
          onTriggerDeleteConfirmation={handleTriggerDeleteConfirmation}
          onSave={handleSubmit}
          onCancel={onCancelEdit}
          isSaving={loading}
          isDeleting={isDeleting}
          isMobile={isMobile}
          isRecurringTransaction={isRecurringTransaction}
          className={cn("w-full pt-0 pb-0 mt-3", isMobile ? "px-2" : "px-3")}
        />
      </form>

      <TransactionDeleteDialogs
        showDeleteOptionsDialog={showDeleteOptionsDialog}
        setShowDeleteOptionsDialog={setShowDeleteOptionsDialog}
        showSimpleDeleteDialog={showSimpleDeleteDialog}
        setShowSimpleDeleteDialog={setShowSimpleDeleteOptionsDialog} // Corrected here
        selectedDeleteScope={selectedDeleteScope}
        setSelectedDeleteScope={setSelectedDeleteScope}
        handleConfirmDelete={handleConfirmDelete}
        loading={loading}
        isFetchingOptions={isFetchingOptions}
        isMobile={isMobile}
        editingTransaction={editingTransaction}
      />

      <TransactionSaveDialogs
        showSaveOptionsDialog={showSaveOptionsDialog}
        setShowSaveOptionsDialog={setShowSaveOptionsDialog}
        selectedSaveScope={selectedSaveScope}
        setSelectedSaveScope={setSelectedSaveScope}
        handleConfirmSave={handleConfirmSave}
        loading={loading}
        isFetchingOptions={isFetchingOptions}
        isMobile={isMobile}
      />
    </>
  );
};
