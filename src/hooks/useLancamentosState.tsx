import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { addMonths, subMonths, parseISO, isValid } from "date-fns";
import { Transaction } from "@/types/finance";
import { Tables } from "@/integrations/supabase/types";
import { isValidUuid } from "@/lib/utils"; // Importar isValidUuid

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
  const [filterPaymentOptionId, setFilterPaymentOptionId] = useState<string>(initialFilterPaymentOption);

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
    filterPaymentOptionId,
    setFilterPaymentOptionId,
    handleCancelEdit,
    isValidUuid,
  };
};