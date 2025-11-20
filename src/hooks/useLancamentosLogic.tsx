import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { addMonths, subMonths, parseISO, isValid } from "date-fns";
import { Transaction } from "@/types/finance";
import { Tables } from "@/integrations/supabase/types";

// Helper function to validate if a string is a UUID
const isValidUuid = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export const useLancamentosState = () => {
  const [searchParams] = useSearchParams();

  const initialMonth = useMemo(() => {
    const monthParam = searchParams.get("month");
    if (monthParam) {
      try {
        const parsedDate = parseISO(monthParam);
        if (isValid(parsedDate)) {
          return parsedDate;
        } else {
          console.error("Invalid date parsed from URL parameter:", monthParam);
          return new Date();
        }
      } catch (e) {
        console.error("Error parsing month parameter from URL:", monthParam, e);
        return new Date();
      }
    }
    return new Date();
  }, [searchParams]);

  const initialFilterPaymentOption = useMemo(() => {
    const cardIdParam = searchParams.get("cardId");
    return cardIdParam && isValidUuid(cardIdParam) ? cardIdParam : "all";
  }, [searchParams]);

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [fullEditingRevenue, setFullEditingRevenue] = useState<Tables<"receitas"> | null>(null);
  const [fullEditingExpense, setFullEditingExpense] = useState<Tables<"despesas"> | null>(null);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [loadingPayInvoice, setLoadingPayInvoice] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteRecurrenceModalOpen, setIsDeleteRecurrenceModalOpen] = useState(false);
  const [selectedRecurringTransactionForDelete, setSelectedRecurringTransactionForDelete] = useState<Transaction | null>(null);
  const [filterPaymentOptionId, setFilterPaymentOptionId] = useState<string>(initialFilterPaymentOption);
  const [filterType, setFilterType] = useState<string>("all"); // NOVO: Estado para o filtro de tipo

  const handlePreviousMonth = useCallback(() => {
    setSelectedMonth((prevMonth) => subMonths(prevMonth, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setSelectedMonth((prevMonth) => addMonths(prevMonth, 1));
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingTransaction(null);
    setFullEditingRevenue(null);
    setFullEditingExpense(null);
    setIsEditModalOpen(false);
  }, []);

  return {
    selectedMonth,
    setSelectedMonth,
    handlePreviousMonth,
    handleNextMonth,
    editingTransaction,
    setEditingTransaction,
    fullEditingRevenue,
    setFullEditingRevenue,
    fullEditingExpense,
    setFullEditingExpense,
    loadingEditData,
    setLoadingEditData,
    loadingPayInvoice,
    setLoadingPayInvoice,
    isEditModalOpen,
    setIsEditModalOpen,
    isDeleteRecurrenceModalOpen,
    setIsDeleteRecurrenceModalOpen,
    selectedRecurringTransactionForDelete,
    setSelectedRecurringTransactionForDelete,
    filterPaymentOptionId,
    setFilterPaymentOptionId,
    filterType, // NOVO: Retornar filterType
    setFilterType, // NOVO: Retornar setFilterType
    handleCancelEdit,
    isValidUuid, // Exportar para uso em useTransactionMutations
  };
};