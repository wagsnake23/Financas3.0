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
    let dateToReturn: Date;
    if (monthParam) {
      try {
        // Parse ISO date-only string as local date to avoid UTC shift issues
        const [year, month, day] = monthParam.split('-').map(Number);
        const parsedDate = new Date(year, month - 1, day || 1);

        if (isValid(parsedDate)) {
          dateToReturn = parsedDate;
        } else {
          console.error("useLancamentosState: Invalid date parsed from URL parameter, defaulting to new Date():", monthParam);
          dateToReturn = new Date();
        }
      } catch (e) {
        console.error("useLancamentosState: Error parsing month parameter from URL, defaulting to new Date():", monthParam, e);
        dateToReturn = new Date();
      }
    } else {
      dateToReturn = new Date();
    }
    console.log("useLancamentosState: Initial selectedMonth:", dateToReturn, "isValid:", isValid(dateToReturn));
    return dateToReturn;
  }, [searchParams]);

  const initialFilterPaymentOption = useMemo(() => {
    const cardIdParam = searchParams.get("cardId");
    return cardIdParam && isValidUuid(cardIdParam) ? cardIdParam : "all";
  }, [searchParams]);

  const initialFilterType = useMemo(() => {
    const typeParam = searchParams.get("type");
    return typeParam === "income" || typeParam === "expense" ? typeParam : "all";
  }, [searchParams]);

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [fullEditingRevenue, setFullEditingRevenue] = useState<Tables<"receitas"> | null>(null);
  const [fullEditingExpense, setFullEditingExpense] = useState<Tables<"despesas"> | null>(null);
  const [loadingEditData, setLoadingEditData] = useState(false);
  const [loadingPayInvoice, setLoadingPayInvoice] = useState(false); // NOVO ESTADO
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [filterPaymentOptionId, setFilterPaymentOptionId] = useState<string>(initialFilterPaymentOption);
  const [filterType, setFilterType] = useState<string>(initialFilterType);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

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
    loadingPayInvoice, // NOVO RETORNO
    setLoadingPayInvoice, // NOVO RETORNO
    isEditModalOpen,
    setIsEditModalOpen,
    filterPaymentOptionId,
    setFilterPaymentOptionId,
    filterType,
    setFilterType,
    filterCategory,
    setFilterCategory,
    searchTerm,
    setSearchTerm,
    handleCancelEdit,
    isValidUuid,
  };
};
