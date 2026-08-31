import React, { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Transaction, AppCategory, TransactionType } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import { cn, isValidUuid, formatCurrency, formatInTimeZone, TARGET_TIMEZONE } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { format, isValid, setDate, getMonth, getYear, addMonths, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/contexts/ToastContext";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import TransactionRow from "./TransactionRow";
import { useNavigate } from "react-router-dom";
import { CreditCardInvoiceSummary } from "@/components/CreditCardInvoiceSummary";
import { Database } from "@/integrations/supabase/types";
import { ArrowUp, ArrowDown, X, Filter } from "lucide-react"; // Importar ícones de seta, X

type ReceitaStatus = Database['public']['Enums']['receita_status'];

interface Cartao {
  id: string;
  nome: string;
  banco: string;
  ultimos_digitos: string;
  dia_fechamento: number;
  dia_vencimento: number;
}

interface TransactionListProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string, type: "income" | "expense", deleteScope: "thisMonth" | "thisMonthForward" | "all" | "oneOff") => void;
  onEditTransaction: (transaction: Transaction) => void;
  allCategories: AppCategory[];
  cartoes: Tables<'cartoes'>[];
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  filterPaymentOptionId: string;
  setFilterPaymentOptionId: (cardId: string) => void;
  loadingPayInvoice: boolean;
  setLoadingPayInvoice: (loading: boolean) => void;
  selectedMonth: Date;
  setSelectedMonth: (month: Date) => void;
  onToggleTransactionStatus: (id: string, type: TransactionType, newStatus: ReceitaStatus) => void;
  filterType: string;
  setFilterType: (type: string) => void;
  filterStatus: "all" | "paid" | "pending";
  setFilterStatus: (status: "all" | "paid" | "pending") => void;
  filterCategory: string;
  setFilterCategory: (category: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const UNSELECTED_VALUE = "unselected";

export const TransactionList = ({
  transactions,
  onDeleteTransaction,
  onEditTransaction,
  allCategories,
  cartoes,
  isMobile,
  queryClient,
  user,
  filterPaymentOptionId,
  setFilterPaymentOptionId,
  selectedMonth,
  loadingPayInvoice,
  setLoadingPayInvoice,
  setSelectedMonth,
  onToggleTransactionStatus,
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  filterCategory,
  setFilterCategory,
  searchTerm,
  setSearchTerm,
}: TransactionListProps) => {
  console.log("TransactionList: User prop received:", user?.id, "Is user null?", !user);
  console.log("TransactionList: selectedMonth (top of component):", selectedMonth, "isValid:", isValid(selectedMonth));

  const [localSearch, setLocalSearch] = useState(searchTerm);

  const activeFilterNames = useMemo(() => {
    const names: string[] = [];
    if (filterStatus === "paid") names.push("Pagos");
    if (filterStatus === "pending") names.push("Pendentes");
    if (filterType === "income") names.push("Receitas");
    if (filterType === "expense") names.push("Despesas");
    if (filterPaymentOptionId === "dinheiro") names.push("Dinheiro");
    else if (filterPaymentOptionId === "pix") names.push("Pix");
    else if (filterPaymentOptionId !== "all") {
      const card = cartoes.find(c => c.id === filterPaymentOptionId);
      if (card) names.push("Cartão");
    }
    return names;
  }, [filterStatus, filterType, filterPaymentOptionId, cartoes]);

  // Sync local search with global search term (e.g. when filters are cleared)
  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  // Debounce logic: update global searchTerm after 400ms of inactivity
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== searchTerm) {
        setSearchTerm(localSearch);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [localSearch, searchTerm, setSearchTerm]);

  const { showSuccessToast, showErrorToast } = useToast();
  const navigate = useNavigate();

  function getCategoryDisplayName(categoryId: string) {
    const category = allCategories.find(cat => cat.id === categoryId);
    return category?.nome || categoryId;
  }

  const [sortColumn, setSortColumn] = useState<string | null>("date"); // Default sort by date
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc"); // Default sort direction

  const paymentFilterOptions = useMemo(() => {
    const options = [
      { value: "all", label: "Forma de Pagamento" },
      { value: "dinheiro", label: "💰 Dinheiro" },
      { value: "pix", label: "🪙 Pix" },
    ];
    cartoes.forEach(card => {
      options.push({
        value: card.id,
        label: `Cartão: ${card.nome} ${card.ultimos_digitos}`
      });
    });
    return options;
  }, [cartoes]);

  useEffect(() => {
    if (isValidUuid(filterPaymentOptionId) && cartoes.length > 0) {
      const cardExists = cartoes.some(card => card.id === filterPaymentOptionId);
      if (!cardExists) {
        console.warn(`TransactionList: Selected card ID ${filterPaymentOptionId} not found in loaded cards. Resetting filter.`);
        setFilterPaymentOptionId("all");
      }
    }
  }, [filterPaymentOptionId, cartoes, setFilterPaymentOptionId]);

  const filteredTransactions = useMemo(() => {
    console.log("TransactionList: filteredTransactions useMemo re-running...");

    return transactions.filter(transaction => {
      const categoryName = getCategoryDisplayName(transaction.category).toLowerCase();
      const description = (transaction.description || "").toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      const matchesSearch = categoryName.includes(searchLower) || description.includes(searchLower);
      const matchesType = filterType === "all" || transaction.type === filterType;
      const matchesCategory = filterCategory === "all" || transaction.category === filterCategory;

      let matchesPaymentOption = true;
      if (filterPaymentOptionId !== "all") {
        if (filterPaymentOptionId === "dinheiro") {
          matchesPaymentOption = transaction.forma_pagamento === "dinheiro";
        } else if (filterPaymentOptionId === "pix") {
          matchesPaymentOption = transaction.forma_pagamento === "pix";
        } else if (isValidUuid(filterPaymentOptionId)) {
          matchesPaymentOption = transaction.forma_pagamento === "cartao" && transaction.cartao_id === filterPaymentOptionId;
        } else {
          matchesPaymentOption = transaction.forma_pagamento === filterPaymentOptionId;
        }
      }

      const finalResult = matchesSearch && matchesType && matchesCategory && matchesPaymentOption;

      return finalResult;
    });
  }, [transactions, searchTerm, filterType, filterCategory, filterPaymentOptionId, allCategories]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedTransactions = useMemo(() => {
    if (!sortColumn) return filteredTransactions;

    const sorted = [...filteredTransactions].sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortColumn) {
        case "date":
          valA = new Date(a.date).getTime();
          valB = new Date(b.date).getTime();
          break;
        case "type":
          valA = a.type;
          valB = b.type;
          break;
        case "category":
          valA = getCategoryDisplayName(a.category);
          valB = getCategoryDisplayName(b.category);
          break;
        case "description":
          valA = a.description || "";
          valB = b.description || "";
          break;
        case "amount":
          valA = a.amount;
          valB = b.amount;
          break;
        default:
          return 0;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }
    });
    return sorted;
  }, [filteredTransactions, sortColumn, sortDirection, allCategories]);

  const summary = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, t) => {
        if (t.type === "income") {
          acc.income += t.amount;
          if (t.status === "Recebida") {
            acc.receivedIncome += t.amount;
          } else {
            acc.pendingIncome += t.amount;
          }
        } else {
          acc.expense += t.amount;
          if (t.status === "Recebida") {
            acc.paidExpense += t.amount;
          }
        }
        acc.count += 1;
        return acc;
      },
      { income: 0, expense: 0, count: 0, paidExpense: 0, receivedIncome: 0, pendingIncome: 0 }
    );
  }, [filteredTransactions]);

  const totalCount = filteredTransactions.length;
  const paidCount = useMemo(() => filteredTransactions.filter(t => t.status === "Recebida").length, [filteredTransactions]);
  const pendingCount = totalCount - paidCount;

  const paidPercentage = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;
  const pendingPercentage = totalCount > 0 ? Math.round((pendingCount / totalCount) * 100) : 0;

  const accumulatedValue = filterType === "expense"
    ? summary.expense - summary.paidExpense
    : filterType === "income"
      ? summary.receivedIncome
      : summary.income - summary.expense;

  const { totalPaidCard, totalPendingCard, totalCardExpenses } = useMemo(() => {
    let paid = 0;
    let pending = 0;
    filteredTransactions
      .filter(t => t.type === "expense")
      .forEach(transaction => {
        if (transaction.status === "Recebida") {
          paid += transaction.amount;
        } else {
          pending += transaction.amount;
        }
      });
    return { totalPaidCard: paid, totalPendingCard: pending, totalCardExpenses: paid + pending };
  }, [filteredTransactions]);

  const lastPaymentDate = useMemo(() => {
    const paidExpenses = filteredTransactions.filter(
      t => t.type === "expense" && t.status === "Recebida" && t.paymentTimestamp
    );
    if (paidExpenses.length === 0) return null;

    const sorted = [...paidExpenses].sort((a, b) => {
      const dateA = a.paymentTimestamp ? new Date(a.paymentTimestamp).getTime() : 0;
      const dateB = b.paymentTimestamp ? new Date(b.paymentTimestamp).getTime() : 0;
      return dateB - dateA;
    });
    return sorted[0].paymentTimestamp;
  }, [filteredTransactions]);

  const selectableCategories = useMemo(() => {
    if (filterType === "income") {
      return allCategories.filter(cat => cat.parent_id === 'receitas_e_investimentos');
    } else {
      return allCategories.filter(cat => cat.parent_id !== 'receitas_e_investimentos');
    }
  }, [allCategories, filterType]);

  const handlePayInvoice = async () => {
    const monthToValidate = new Date(selectedMonth);

    console.log("handlePayInvoice: monthToValidate:", monthToValidate);
    console.log("handlePayInvoice: isValid(monthToValidate):", isValid(monthToValidate));

    if (!user) {
      showErrorToast("Erro de Autenticação", "Por favor, faça login novamente.");
      return;
    }
    if (!isValidUuid(filterPaymentOptionId)) {
      showErrorToast("Seleção Inválida", "Selecione um cartão de crédito válido para pagar a fatura.");
      return;
    }
    if (!isValid(monthToValidate)) {
      showErrorToast("Data Inválida", "Data do mês selecionado é inválida.");
      console.error("Invalid selectedMonth in handlePayInvoice (using date-fns isValid):", selectedMonth, "Validated object:", monthToValidate);
      return;
    }

    setLoadingPayInvoice(true);

    try {
      const installmentIdsToUpdate = filteredTransactions
        .filter(t => t.type === "expense" && t.status !== "Recebida")
        .map(t => t.id);

      if (installmentIdsToUpdate.length === 0) {
        showErrorToast("Aviso", "Nenhuma despesa pendente encontrada para este cartão no mês selecionado.");
        setLoadingPayInvoice(false);
        return;
      }

      const { error } = await supabase
        .from("despesas_parcelas")
        .update({
          pago: true,
          data_pagamento: formatInTimeZone(new Date(), TARGET_TIMEZONE, "yyyy-MM-dd HH:mm:ss"),
        })
        .in("id", installmentIdsToUpdate);

      if (error) {
        throw error;
      }

      showSuccessToast("Sucesso", "Fatura paga com sucesso!");

      queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });

    } catch (error: any) {
      console.error("Erro ao pagar fatura:", error);
      showErrorToast("Erro ao Pagar Fatura", error.message || "Ocorreu um erro inesperado.");
    } finally {
      setLoadingPayInvoice(false);
    }
  };

  const cardDetails = useMemo(() => {
    const monthForCardDetails = new Date(selectedMonth);
    console.log("cardDetails useMemo: monthForCardDetails:", monthForCardDetails);
    console.log("cardDetails useMemo: isValid(monthForCardDetails):", isValid(monthForCardDetails));

    if (!isValidUuid(filterPaymentOptionId) || !isValid(monthForCardDetails)) {
      return null;
    }
    const selectedCard = cartoes.find(card => card.id === filterPaymentOptionId);
    if (!selectedCard) {
      return null;
    }

    const currentYear = getYear(monthForCardDetails);
    const currentMonthIndex = getMonth(monthForCardDetails);

    let closingDateForDisplay = setDate(new Date(currentYear, currentMonthIndex), selectedCard.dia_fechamento);
    if (!isValid(closingDateForDisplay)) {
      closingDateForDisplay = setDate(endOfMonth(new Date(currentYear, currentMonthIndex)), selectedCard.dia_fechamento);
    }
    const formattedClosingDate = isValid(closingDateForDisplay) ? format(closingDateForDisplay, "dd/MM", { locale: ptBR }) : null;

    let dueDateForDisplay = setDate(new Date(currentYear, currentMonthIndex), selectedCard.dia_vencimento);
    dueDateForDisplay = addMonths(dueDateForDisplay, 1);
    if (!isValid(dueDateForDisplay)) {
      dueDateForDisplay = setDate(endOfMonth(addMonths(new Date(currentYear, currentMonthIndex), 1)), selectedCard.dia_vencimento);
    }
    const formattedDueDate = isValid(dueDateForDisplay) ? format(dueDateForDisplay, "dd/MM", { locale: ptBR }) : null;

    return {
      closingDay: selectedCard.dia_fechamento,
      formattedClosingDate,
      formattedDueDate,
      cardLastDigits: selectedCard.ultimos_digitos,
    };
  }, [filterPaymentOptionId, selectedMonth, cartoes]);

  console.log("TransactionList: Raw transactions count (for selected month):", transactions.length);
  console.log("TransactionList: Filtered transactions count (after all filters):", filteredTransactions.length);

  const disablePayInvoiceButton = useMemo(() => {
    if (!isValidUuid(filterPaymentOptionId)) return true;
    if (loadingPayInvoice) return true;
    const hasPendingExpenses = filteredTransactions.some(t =>
      t.type === "expense" &&
      t.status !== "Recebida" &&
      t.forma_pagamento === "cartao" &&
      t.cartao_id === filterPaymentOptionId
    );
    return !hasPendingExpenses;
  }, [filterPaymentOptionId, loadingPayInvoice, filteredTransactions]);

  const hideTypeFilter = isMobile && filterPaymentOptionId !== "all";

  const statusFilteredTransactions = useMemo(() => {
    return sortedTransactions.filter(t => {
      if (filterStatus === "all") return true;
      if (filterStatus === "paid") return t.status === "Recebida";
      if (filterStatus === "pending") return t.status !== "Recebida";
      return true;
    });
  }, [sortedTransactions, filterStatus]);

  // Usa statusFilteredTransactions tanto no mobile quanto no desktop
  const transactionsToDisplay = statusFilteredTransactions;

  // Remove auto-scroll
  const getTodayMarkerText = () => {
    const date = new Date();
    const weekdayRaw = format(date, "EEEE", { locale: ptBR });
    const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1);
    const day = format(date, "dd", { locale: ptBR });
    const mmmRaw = format(date, "MMM", { locale: ptBR });
    const mmm = mmmRaw.charAt(0).toUpperCase() + mmmRaw.slice(1).replace(".", "");
    return `Hoje • ${weekday}, ${day} ${mmm}`;
  };

  // Recuperar a lógica original de exibição e cálculo do índice "Hoje"
  const todayMarkerIndex = useMemo(() => {
    if (!isMobile || !sortColumn) return -1;
    
    const today = new Date();
    const isCurrentMonth = selectedMonth.getMonth() === today.getMonth() && selectedMonth.getFullYear() === today.getFullYear();
    if (!isCurrentMonth || transactionsToDisplay.length === 0) return -1;
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (sortColumn === "date" && sortDirection === "desc") {
      const idx = transactionsToDisplay.findIndex(t => {
        const [y, m, d] = t.date.split("-").map(Number);
        const tDate = new Date(y, m - 1, d);
        tDate.setHours(0, 0, 0, 0);
        return tDate.getTime() <= todayStart.getTime();
      });
      return idx === -1 ? transactionsToDisplay.length : idx;
    } else if (sortColumn === "date" && sortDirection === "asc") {
      const idx = transactionsToDisplay.findIndex(t => {
        const [y, m, d] = t.date.split("-").map(Number);
        const tDate = new Date(y, m - 1, d);
        tDate.setHours(0, 0, 0, 0);
        return tDate.getTime() >= todayStart.getTime();
      });
      return idx === -1 ? transactionsToDisplay.length : idx;
    }
    return -1;
  }, [transactionsToDisplay, isMobile, selectedMonth, sortColumn, sortDirection]);

  // Posicionamento instantâneo sem animação e sem setTimeout
  const todayMarkerRef = useRef<HTMLDivElement>(null);
  const scrolledMonthRef = useRef<string | null>(null);

  useEffect(() => {
    const monthKey = `${selectedMonth.getFullYear()}-${selectedMonth.getMonth()}`;
    if (todayMarkerIndex !== -1 && todayMarkerRef.current && scrolledMonthRef.current !== monthKey) {
      scrolledMonthRef.current = monthKey;
      todayMarkerRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, [todayMarkerIndex, selectedMonth]);

  // Ordenação customizada EXCLUSIVA para os lançamentos de Hoje
  const finalDisplayTransactions = useMemo(() => {
    if (!isMobile || sortColumn !== "date" || transactionsToDisplay.length === 0) return transactionsToDisplay;

    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayItems = transactionsToDisplay.filter(t => t.date === todayStr);

    if (todayItems.length <= 1) return transactionsToDisplay;

    // Ordena os itens de hoje por created_at DESC
    const sortedTodayItems = [...todayItems].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeA === 0 && timeB === 0) return 0;
      return timeB - timeA;
    });

    // Mapeia preservando exatamente a mesma estrutura global
    return transactionsToDisplay.map(t => {
      if (t.date === todayStr) {
        return sortedTodayItems.shift()!;
      }
      return t;
    });
  }, [transactionsToDisplay, isMobile, sortColumn]);



  return (
    <div className={cn("flex flex-col h-full", isMobile ? "p-0 bg-[#FFFFFF] flex-1 min-h-0" : "pb-0")}>

      {/* Barra de Filtros Unificada (Desktop) / Stacked (Mobile) */}
      <div className={cn(
        "flex flex-col",
        isMobile ? "shrink-0 gap-2 mb-1 mt-[1px]" : "mb-2 mt-1 pb-3 border-b border-slate-200/60"
      )}>
        <div className={cn("flex w-full", isMobile ? "flex-col" : "flex-row gap-2")}>
        {/* Campo de Pesquisa */}
        <div className={cn("relative group w-full", !isMobile && "flex-[1.5]")}>
          <Input
            placeholder="Digite para buscar..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className={cn(
              "pl-10 pr-10 rounded-xl transition-all placeholder:font-normal",
              isMobile
                ? "h-9 border border-solid border-[#B8BEC8] shadow-none outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#B8BEC8] focus-within:ring-0 bg-white/80 backdrop-blur-sm group-hover:bg-white placeholder:text-gray-400 text-sm"
                : "h-[42px] border-[#E2E8F0] shadow-sm bg-white focus-visible:ring-0 text-[15px] placeholder:text-slate-500"
            )}
          />
          <div className="absolute left-4 inset-y-0 flex items-center pointer-events-none z-10">
            <span className={cn("select-none leading-none", isMobile ? "text-sm text-gray-500" : "text-[16px] text-slate-500 font-medium")}>🔍</span>
          </div>
          {localSearch && (
            <button
              onClick={() => {
                setLocalSearch("");
                setSearchTerm("");
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Container de Filtros */}
        {!isMobile && (
          <div className={cn(
            "flex gap-2 overflow-x-auto no-scrollbar py-0.5 shrink-0 items-center flex-[3] overflow-visible"
          )}>
            {/* Chip: Tipo */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger
                className={cn(
                  "flex-1 h-[40px] px-3.5 text-[13px] whitespace-nowrap transition-all shadow-none border rounded-[12px] [&>svg]:opacity-100",
                  filterType !== "all"
                    ? "bg-white hover:bg-slate-50 border-[#E2E8F0] font-bold [&>svg]:text-current " + (filterType === "expense" ? "text-[#E55B5B]" : "text-[#26A765]")
                    : "bg-white text-slate-600 hover:bg-slate-50 border-[#E2E8F0] font-medium [&>svg]:text-slate-400"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <SelectValue placeholder="Todos os tipos" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-xl">
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
              </SelectContent>
            </Select>

            {/* Chip: Status */}
            <Select value={filterStatus} onValueChange={(val: "all" | "paid" | "pending") => setFilterStatus(val)}>
              <SelectTrigger
                className={cn(
                  "flex-1 h-[40px] px-3.5 text-[13px] whitespace-nowrap transition-all shadow-none border rounded-[12px] [&>svg]:opacity-100",
                  filterStatus !== "all"
                    ? "bg-white hover:bg-slate-50 border-[#E2E8F0] font-bold [&>svg]:text-current " + (filterStatus === "paid" ? "text-[#26A765]" : "text-[#E55B5B]")
                    : "bg-white text-slate-600 hover:bg-slate-50 border-[#E2E8F0] font-medium [&>svg]:text-slate-400"
                )}
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-xl">
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="paid">✅ Pagos / Recebidos</SelectItem>
                <SelectItem value="pending">⏳ Pendentes</SelectItem>
              </SelectContent>
            </Select>

            {/* Chip: Forma de Pagamento */}
            <Select value={filterPaymentOptionId} onValueChange={setFilterPaymentOptionId}>
              <SelectTrigger
                className={cn(
                  "flex-1 h-[40px] px-3.5 text-[13px] whitespace-nowrap transition-all shadow-none border rounded-[12px] [&>svg]:opacity-100",
                  filterPaymentOptionId !== "all"
                    ? "bg-white hover:bg-slate-50 border-[#E2E8F0] font-bold [&>svg]:text-current " + (isValidUuid(filterPaymentOptionId) ? "text-[#2B75D6]" : (filterType === "expense" ? "text-[#E55B5B]" : "text-[#26A765]"))
                    : "bg-white text-slate-600 hover:bg-slate-50 border-[#E2E8F0] font-medium [&>svg]:text-slate-400"
                )}
              >
                <SelectValue placeholder="Forma de Pagamento" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-xl">
                {paymentFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        </div>

        {/* Resumo Integrado (Apenas Desktop) */}
        {!isMobile && (
          <div className="flex flex-row w-full pt-3 pb-0 px-0 gap-2 items-center">
            {/* Bloco 1: Alinha com o campo de Busca */}
            <div className="flex-[1.5] flex flex-row items-baseline justify-start gap-1.5 relative">
              <span className="text-[13px] text-slate-500 font-medium">Lançamentos:</span>
              <span className="text-[14px] font-bold text-slate-700">{summary.count} itens</span>
              <div className="absolute -right-[5px] w-[1px] h-4 bg-slate-200" style={{ marginRight: '-0.5px' }}></div>
            </div>

            {/* Bloco 2: Alinha com os 3 Selects */}
            <div className="flex-[3] flex flex-row gap-2 items-center">
              {/* Alinha com Tipo */}
              <div className="flex-1 flex flex-row items-baseline justify-start gap-1.5 relative pl-3.5">
                <span className="text-[13px] text-slate-500 font-medium">
                  {filterType === 'expense' ? 'Valor Pago:' : 'Receitas:'}
                </span>
                <span className="text-[14px] font-bold text-[#22C55E]">
                  {formatCurrency(filterType === 'expense' ? summary.paidExpense : summary.income, true)}
                </span>
                <div className="absolute -right-[5px] w-[1px] h-4 bg-slate-200" style={{ marginRight: '-0.5px' }}></div>
              </div>

              {/* Alinha com Status */}
              <div className="flex-1 flex flex-row items-baseline justify-start gap-1.5 relative pl-3.5">
                <span className="text-[13px] text-slate-500 font-medium">
                  {filterType === 'income' ? 'Pendente:' : 'Despesas:'}
                </span>
                <span className={cn(
                  "text-[14px] font-bold",
                  filterType === 'income' ? "text-[#FF8888]" : "text-[#E55B5B]"
                )}>
                  {formatCurrency(filterType === 'income' ? summary.pendingIncome : summary.expense, true)}
                </span>
                <div className="absolute -right-[5px] w-[1px] h-4 bg-slate-200" style={{ marginRight: '-0.5px' }}></div>
              </div>

              {/* Alinha com Forma de Pagamento */}
              <div className="flex-1 flex flex-row items-baseline justify-end gap-1.5 relative">
                <span className="text-[13px] text-slate-500 font-medium">
                  {filterType === 'income' ? 'Recebidas:' : 'Saldo:'}
                </span>
                <span className={cn(
                  "text-[14px] font-bold",
                  filterType === 'income' ? "text-primary" : "text-[#3B82F6]"
                )}>
                  {formatCurrency(filterType === 'income' ? summary.receivedIncome : accumulatedValue, true)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {isValidUuid(filterPaymentOptionId) && (
        <div className={cn("mt-4", isMobile && "w-full mt-0")}> {/* Removido a margem superior no mobile para aproximar dos filtros */}
          <CreditCardInvoiceSummary
            totalPaid={totalPaidCard}
            totalPending={totalPendingCard}
            totalCardExpenses={totalCardExpenses}
            isMobile={!!isMobile}
            formattedDueDate={cardDetails?.formattedDueDate || null}
            formattedClosingDate={cardDetails?.formattedClosingDate || null}
            cardLastDigits={cardDetails?.cardLastDigits || null}
            selectedMonth={selectedMonth} /* Passando selectedMonth */
            onPayInvoice={handlePayInvoice}
            loadingPayInvoice={loadingPayInvoice}
            disablePayInvoiceButton={disablePayInvoiceButton}
            paymentDate={lastPaymentDate}
          />
        </div>
      )}

        <div 
          className={cn(
            "mt-1",
            isMobile ? "bg-[#FFFFFF] flex-1 overflow-y-auto no-scrollbar" : "w-full max-h-[68vh] overflow-y-auto no-scrollbar"
          )}
          style={isMobile ? {
            marginLeft: "calc(-1 * clamp(18px, 4vw, 32px))",
            marginRight: "calc(-1 * clamp(18px, 4vw, 32px))",
          } : undefined}
        >
        {isMobile ? (
          <div className="flex flex-col gap-0 pb-4">
            {finalDisplayTransactions.length === 0 ? (
              <div 
                className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200"
                style={{
                  marginLeft: "clamp(18px, 4vw, 32px)",
                  marginRight: "clamp(18px, 4vw, 32px)"
                }}
              >
                <p className="text-muted-foreground font-medium">Nenhum lançamento encontrado</p>
              </div>
            ) : (
              <>
                {finalDisplayTransactions.map((transaction, index) => (
                  <React.Fragment key={transaction.id}>
                    {todayMarkerIndex === index && (
                      <div 
                        ref={todayMarkerRef} 
                        className="flex items-center justify-center w-full my-1 h-[20px]"
                        style={{
                          paddingLeft: "clamp(18px, 4vw, 32px)",
                          paddingRight: "clamp(18px, 4vw, 32px)"
                        }}
                      >
                        <div className="h-[1px] bg-slate-200/80 flex-1"></div>
                        <div className="flex items-center gap-1.5 text-[#2B75D6] text-[12px] font-semibold px-3 leading-none">
                          <span className="text-[12px] leading-none">📍</span>
                          <span>{getTodayMarkerText()}</span>
                        </div>
                        <div className="h-[1px] bg-slate-200/80 flex-1"></div>
                      </div>
                    )}
                    <TransactionRow
                      transaction={transaction}
                      onDeleteTransaction={onDeleteTransaction}
                      onEditTransaction={onEditTransaction}
                      allCategories={allCategories}
                      cartoes={cartoes}
                      isMobile={isMobile}
                      queryClient={queryClient}
                      user={user}
                      onToggleStatus={onToggleTransactionStatus}
                      isLastItem={index === finalDisplayTransactions.length - 1}
                    />
                  </React.Fragment>
                ))}
                {todayMarkerIndex === transactionsToDisplay.length && transactionsToDisplay.length > 0 && (
                  <div 
                    ref={todayMarkerRef} 
                    className="flex items-center justify-center w-full my-1 h-[20px]"
                    style={{
                      paddingLeft: "clamp(18px, 4vw, 32px)",
                      paddingRight: "clamp(18px, 4vw, 32px)"
                    }}
                  >
                    <div className="h-[1px] bg-slate-200/80 flex-1"></div>
                    <div className="flex items-center gap-1.5 text-[#2B75D6] text-[12px] font-semibold px-3 leading-none">
                      <span className="text-[12px] leading-none">📍</span>
                      <span>{getTodayMarkerText()}</span>
                    </div>
                    <div className="h-[1px] bg-slate-200/80 flex-1"></div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-[6px] pb-8">
              {transactionsToDisplay.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground font-medium">
                  Nenhum lançamento encontrado
                </div>
              ) : (
                transactionsToDisplay.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    onDeleteTransaction={onDeleteTransaction}
                    onEditTransaction={onEditTransaction}
                    allCategories={allCategories}
                    cartoes={cartoes}
                    isMobile={isMobile}
                    queryClient={queryClient}
                    user={user}
                    onToggleStatus={onToggleTransactionStatus}
                  />
                ))
              )}
            </div>
        )}
      </div>

      {/* Barra de Resumo Estilo Card Cinza - Ajustada para Visibilidade Mobile */}
      <div className={cn(
        "mt-auto relative z-20",
        isMobile ? "w-full shrink-0" : "hidden"
      )}>
        {isMobile && (
          /* Mobile premium bottom bar */
          <div 
            className="bg-[#FFFFFF] rounded-none overflow-hidden border-t border-slate-300 px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]"
            style={{ 
              marginLeft: "calc(-1 * clamp(18px, 4vw, 32px))", 
              marginRight: "calc(-1 * clamp(18px, 4vw, 32px))" 
            }}
          >
            <div className="flex flex-col w-full">
              {/* LINHA 1: CONTEXTO E FILTRO */}
              <div className="flex items-center justify-between w-full pb-2">
                <span className="text-xs xs:text-[13px] text-slate-500 font-medium">
                  {filterStatus === "pending" ? pendingCount : filterStatus === "paid" ? paidCount : totalCount} {(filterStatus === "pending" ? pendingCount : filterStatus === "paid" ? paidCount : totalCount) === 1 ? "item" : "itens"} • <span className="text-[#22C55E] font-bold">{paidPercentage}% pagos</span>
                </span>

                <div className={cn(
                  "flex items-center rounded-full border shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] h-[29px] max-w-[55vw] transition-all mt-[3px]",
                  activeFilterNames.length > 0
                    ? "bg-[#EFF6FF] border-[#BFDBFE]"
                    : "border-black/[0.08] bg-white/60"
                )}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={cn(
                        "h-full py-0 text-xs font-bold flex items-center gap-1.5 focus:outline-none min-w-0 transition-all",
                        activeFilterNames.length > 0 
                          ? "pl-3 pr-2 rounded-l-full border-r border-[#BFDBFE] hover:bg-blue-100/50 text-[#1D4ED8]" 
                          : "px-3 rounded-full hover:bg-slate-50 text-slate-700"
                      )}>
                        <Filter 
                          className={cn(
                            "h-3 w-3 shrink-0", 
                            activeFilterNames.length > 0 ? "text-[#1D4ED8]" : "text-slate-400"
                          )} 
                          strokeWidth={2.5} 
                        />
                        {activeFilterNames.length > 0 ? (
                          <span className="truncate">{activeFilterNames.join(" • ")}</span>
                        ) : (
                          "Todos"
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-[304px] rounded-[16px] border border-slate-100 shadow-xl p-4 bg-white mb-2 relative" 
                      align="end"
                      sideOffset={8}
                    >
                      <PopoverClose className="absolute right-[11px] top-[7px] p-1.5 rounded-full bg-[#E55B5B]/10 text-[#E55B5B] hover:bg-[#E55B5B]/20 transition-colors focus:outline-none">
                        <X className="h-3.5 w-3.5" strokeWidth={3} />
                      </PopoverClose>
                      <div className="flex flex-col gap-4 mt-[10px]">
                        {/* Status */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</span>
                          <Select 
                            value={filterStatus} 
                            onValueChange={(val: "all" | "paid" | "pending") => setFilterStatus(val)}
                          >
                            <SelectTrigger className="h-9 rounded-[10px] text-[13px] font-semibold bg-slate-50/80 border-slate-200/60 focus:ring-0 focus:ring-offset-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-[14px]">
                              <SelectItem value="all" className="text-[13px] font-medium py-2">Todos</SelectItem>
                              <SelectItem value="paid" className="text-[13px] font-medium py-2">Pagos</SelectItem>
                              <SelectItem value="pending" className="text-[13px] font-medium py-2">Pendentes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Tipo */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tipo</span>
                          <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger className="h-9 rounded-[10px] text-[13px] font-semibold bg-slate-50/80 border-slate-200/60 focus:ring-0 focus:ring-offset-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-[14px]">
                              <SelectItem value="all" className="text-[13px] font-medium py-2">Todos</SelectItem>
                              <SelectItem value="income" className="text-[13px] font-medium py-2">Receitas</SelectItem>
                              <SelectItem value="expense" className="text-[13px] font-medium py-2">Despesas</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Forma de Pagamento */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Forma de Pagamento</span>
                          <Select value={filterPaymentOptionId} onValueChange={setFilterPaymentOptionId}>
                            <SelectTrigger className="h-9 rounded-[10px] text-[13px] font-semibold bg-slate-50/80 border-slate-200/60 focus:ring-0 focus:ring-offset-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-[14px]">
                              {paymentFilterOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value} className="text-[13px] font-medium py-2">
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {activeFilterNames.length > 0 && (
                    <button 
                      className="h-full px-2.5 flex items-center justify-center text-[10px] text-[#E55B5B] opacity-90 hover:opacity-100 font-bold hover:bg-[#E55B5B]/10 cursor-pointer shrink-0 rounded-r-full transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFilterStatus("all");
                        setFilterType("all");
                        setFilterPaymentOptionId("all");
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* LINHAS 2 E 3: INDICADORES */}
              <div className="grid grid-cols-3 w-full pt-1 text-center">
                {/* Coluna 1 */}
                <div className="flex flex-col items-center">
                  <span className="text-[11px] xs:text-[12px] sm:text-[13px] text-slate-500 font-bold tracking-wide">
                    {filterType === 'expense' ? 'Pago' : 'Receitas'}
                  </span>
                  <span className="text-sm xs:text-[15px] font-bold text-[#22C55E] mt-0.5 whitespace-nowrap">
                    {formatCurrency(filterType === 'expense' ? summary.paidExpense : summary.income, true)}
                  </span>
                </div>

                {/* Coluna 2 */}
                <div className="flex flex-col items-center">
                  <span className="text-[11px] xs:text-[12px] sm:text-[13px] text-slate-500 font-bold tracking-wide">
                    {filterType === 'income' ? 'Pendente' : 'Despesas'}
                  </span>
                  <span className={cn(
                    "text-sm xs:text-[15px] font-bold mt-0.5 whitespace-nowrap",
                    filterType === 'income' ? "text-[#FF8888]" : "text-destructive"
                  )}>
                    {formatCurrency(filterType === 'income' ? summary.pendingIncome : summary.expense, true)}
                  </span>
                </div>

                {/* Coluna 3 */}
                <div className="flex flex-col items-center">
                  <span className="text-[11px] xs:text-[12px] sm:text-[13px] text-slate-500 font-bold tracking-wide">
                    Saldo
                  </span>
                  <span className="text-sm xs:text-[15px] font-bold text-primary mt-0.5 whitespace-nowrap">
                    {formatCurrency(accumulatedValue, true)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
