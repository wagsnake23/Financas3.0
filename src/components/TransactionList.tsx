import React, { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  filterCategory,
  setFilterCategory,
  searchTerm,
  setSearchTerm,
}: TransactionListProps) => {
  console.log("TransactionList: User prop received:", user?.id, "Is user null?", !user);
  console.log("TransactionList: selectedMonth (top of component):", selectedMonth, "isValid:", isValid(selectedMonth));

  const [localSearch, setLocalSearch] = useState(searchTerm);
  const [footerStatusFilter, setFooterStatusFilter] = useState<"all" | "paid" | "pending">("all");

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

  const mobileStatusFilteredTransactions = useMemo(() => {
    if (!isMobile) return sortedTransactions;
    return sortedTransactions.filter(t => {
      if (footerStatusFilter === "all") return true;
      if (footerStatusFilter === "paid") return t.status === "Recebida";
      if (footerStatusFilter === "pending") return t.status !== "Recebida";
      return true;
    });
  }, [sortedTransactions, footerStatusFilter, isMobile]);

  // Removido o slice para que todas as transações filtradas sejam exibidas e a rolagem funcione
  const transactionsToDisplay = isMobile ? mobileStatusFilteredTransactions : sortedTransactions;

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
    <div className={cn("pt-0", isMobile ? "p-0 flex-1 flex flex-col min-h-0 h-full bg-[#FFFFFF]" : "pb-6")}>

      {/* Barra de Filtros Unificada (Desktop) / Stacked (Mobile) */}
      <div className={cn(
        "flex flex-col gap-2 mb-1",
        !isMobile && "flex-row items-center gap-3 mb-6"
      )}>
        {/* Campo de Pesquisa */}
        <div className={cn("relative group w-full", !isMobile && "flex-1")}>
          <Input
            placeholder="Digite para buscar..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10 pr-10 h-9 md:h-10 rounded-xl border-gray-200 bg-white/80 backdrop-blur-sm focus-visible:ring-primary/20 focus-visible:border-primary transition-all shadow-sm group-hover:bg-white placeholder:text-gray-400 placeholder:font-normal text-sm"
          />
          <div className="absolute left-4 inset-y-0 flex items-center pointer-events-none z-10">
            <span className="text-sm select-none leading-none">🔍</span>
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
        <div className={cn(
          "flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 flex-nowrap shrink-0",
          !isMobile && "flex-[3] overflow-visible"
        )}>
          {/* Chip: Tipo */}
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger
              className={cn(
                "h-8 px-3.5 text-xs font-semibold whitespace-nowrap transition-all shadow-none border rounded-[10px]",
                filterType !== "all"
                  ? (filterType === "expense" ? "bg-[#E55B5B] hover:bg-[#E55B5B]/90" : "bg-[#26A765] hover:bg-[#26A765]/90") + " text-white border-transparent font-bold"
                  : "bg-slate-50/80 text-slate-500 hover:bg-slate-100 border-slate-200/60 font-medium",
                hideTypeFilter && "hidden",
                !isMobile && "flex-1 h-9"
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

          {/* Chip: Subcategoria */}
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger
              className={cn(
                "h-8 px-3.5 text-xs font-semibold whitespace-nowrap transition-all shadow-none border rounded-[10px]",
                filterCategory !== "all"
                  ? (filterType === "expense" ? "bg-[#E55B5B] hover:bg-[#E55B5B]/90" : "bg-[#26A765] hover:bg-[#26A765]/90") + " text-white border-transparent font-bold"
                  : "bg-slate-50/80 text-slate-500 hover:bg-slate-100 border-slate-200/60 font-medium",
                !isMobile && "flex-1 h-9"
              )}
            >
              <SelectValue placeholder="Subcategoria" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-xl">
              <SelectItem value="all">Subcategoria</SelectItem>
              {selectableCategories
                .filter(cat => cat.id !== "")
                .map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <span>{cat.icone}</span>
                      <span>{getCategoryDisplayName(cat.id)}</span>
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {/* Chip: Forma de Pagamento */}
          <Select value={filterPaymentOptionId} onValueChange={setFilterPaymentOptionId}>
            <SelectTrigger
              className={cn(
                "h-8 px-3.5 text-xs font-semibold whitespace-nowrap transition-all shadow-none border rounded-[10px]",
                filterPaymentOptionId !== "all"
                  ? (isValidUuid(filterPaymentOptionId)
                    ? "bg-[#2B75D6] hover:bg-[#2B75D6]/90"
                    : (filterType === "expense" ? "bg-[#E55B5B] hover:bg-[#E55B5B]/90" : "bg-[#26A765] hover:bg-[#26A765]/90")
                  ) + " text-white border-transparent font-bold"
                  : "bg-slate-50/80 text-slate-500 hover:bg-slate-100 border-slate-200/60 font-medium",
                !isMobile && "flex-1 h-9"
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
          />
        </div>
      )}

      <div className={cn(
        !isMobile && "rounded-xl border shadow-sm bg-white lancamentos-wrapper mt-4",
        isMobile ? "flex-1 overflow-y-auto w-full mt-1 no-scrollbar bg-[#FFFFFF]" : ""
      )}>
        {isMobile ? (
          <div className="flex flex-col gap-1 pb-4">
            {finalDisplayTransactions.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                <p className="text-muted-foreground font-medium">Nenhum lançamento encontrado</p>
              </div>
            ) : (
              <>
                {finalDisplayTransactions.map((transaction, index) => (
                  <React.Fragment key={transaction.id}>
                    {todayMarkerIndex === index && (
                      <div ref={todayMarkerRef} className="flex items-center justify-center w-full my-1 h-[20px]">
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
                    />
                  </React.Fragment>
                ))}
                {todayMarkerIndex === transactionsToDisplay.length && transactionsToDisplay.length > 0 && (
                  <div ref={todayMarkerRef} className="flex items-center justify-center w-full my-1 h-[20px]">
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
          <div className="lancamentos-scroll-container pb-8">
            <Table className="lancamentos-table table-fixed border-separate border-spacing-0">
              <TableHeader className="lancamentos-table-header bg-gradient-to-b from-blue-50 to-white">
                <TableRow>
                  <TableHead className="w-[12%] py-4">
                    Data
                  </TableHead>
                  <TableHead className="text-center w-[12%] py-4">
                    Tipo
                  </TableHead>
                  <TableHead className="w-[18%] py-4">
                    Subcategoria
                  </TableHead>
                  <TableHead className="text-left w-[20%] py-4">
                    Descrição
                  </TableHead>
                  <TableHead className="text-right w-[15%] py-4">
                    Valor
                  </TableHead>
                  <TableHead className="text-center w-[10%] py-4">Status</TableHead>
                  <TableHead className="text-center w-[13%] py-4">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="lancamentos-table-body">
                {transactionsToDisplay.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground font-medium">
                      Nenhum lançamento encontrado
                    </TableCell>
                  </TableRow>
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
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Barra de Resumo Estilo Card Cinza - Ajustada para Visibilidade Mobile */}
      <div className={cn(
        "mt-auto relative z-20",
        isMobile ? "w-full" : "mt-8 w-full px-0 mb-4"
      )}>
        {isMobile ? (
          /* Mobile premium bottom bar */
          <div 
            className="bg-[#FFFFFF] rounded-t-[10px] overflow-hidden border-t border-[#E9EDF2] px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]"
            style={{ 
              marginLeft: "calc(-1 * clamp(18px, 4vw, 32px))", 
              marginRight: "calc(-1 * clamp(18px, 4vw, 32px))" 
            }}
          >
            <div className="flex flex-col w-full">
              {/* LINHA 1: CONTEXTO E FILTRO */}
              <div className="flex items-center justify-between w-full pb-2 border-b border-black/[0.04]">
                {footerStatusFilter === "all" ? (
                  <span className="text-xs xs:text-[13px] text-slate-500 font-medium">
                    📄 {totalCount} {totalCount === 1 ? "item" : "itens"} • <span className="text-[#22C55E] font-bold">{paidPercentage}% pagos</span>
                  </span>
                ) : footerStatusFilter === "paid" ? (
                  <span className="text-xs xs:text-[13px] text-slate-500 font-medium">
                    📄 {paidCount} {paidCount === 1 ? "item" : "itens"} • <span className="text-[#22C55E] font-bold">{paidPercentage}% pagos</span>
                  </span>
                ) : (
                  <span className="text-xs xs:text-[13px] text-slate-500 font-medium">
                    📄 {pendingCount} {pendingCount === 1 ? "item" : "itens"} • <span className="text-[#FF8888] font-bold">{pendingPercentage}% pendentes</span>
                  </span>
                )}

                <Select 
                  value={footerStatusFilter} 
                  onValueChange={(val: "all" | "paid" | "pending") => setFooterStatusFilter(val)}
                >
                  <SelectTrigger className="h-[26px] py-0 px-3 text-xs font-bold rounded-full border border-black/[0.08] bg-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8)] hover:bg-slate-50 text-slate-700 gap-1.5 focus:ring-0 focus:ring-offset-0 w-auto transition-all">
                    <div className="flex items-center gap-1 max-w-[85px]">
                      <Filter className="h-3 w-3 text-slate-400 shrink-0" strokeWidth={2.5} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-[14px] border border-slate-100 shadow-xl overflow-hidden">
                    <SelectItem value="all" className="text-[13px] font-medium py-2">Todos</SelectItem>
                    <SelectItem value="paid" className="text-[13px] font-medium py-2">Pagos</SelectItem>
                    <SelectItem value="pending" className="text-[13px] font-medium py-2">Pendentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* LINHAS 2 E 3: INDICADORES */}
              <div className="grid grid-cols-3 w-full pt-1 text-center">
                {/* Coluna 1 */}
                <div className="flex flex-col items-center">
                  <span className="text-[10px] xs:text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wide">
                    {filterType === 'expense' ? 'Pago' : 'Receitas'}
                  </span>
                  <span className="text-sm xs:text-[15px] font-black text-[#22C55E] mt-0.5 whitespace-nowrap">
                    {formatCurrency(filterType === 'expense' ? summary.paidExpense : summary.income, true)}
                  </span>
                </div>

                {/* Coluna 2 */}
                <div className="flex flex-col items-center border-l border-black/[0.04]">
                  <span className="text-[10px] xs:text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wide">
                    {filterType === 'income' ? 'Pendente' : 'Despesas'}
                  </span>
                  <span className={cn(
                    "text-sm xs:text-[15px] font-black mt-0.5 whitespace-nowrap",
                    filterType === 'income' ? "text-[#FF8888]" : "text-destructive"
                  )}>
                    {formatCurrency(filterType === 'income' ? summary.pendingIncome : summary.expense, true)}
                  </span>
                </div>

                {/* Coluna 3 */}
                <div className="flex flex-col items-center border-l border-black/[0.04]">
                  <span className="text-[10px] xs:text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wide">
                    Saldo
                  </span>
                  <span className="text-sm xs:text-[15px] font-black text-primary mt-0.5 whitespace-nowrap">
                    {formatCurrency(accumulatedValue, true)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Desktop version (UNCHANGED) */
          <div className="bg-slate-50 flex items-center justify-between w-full gap-2 px-4 border-t border-gray-300 pt-3 pb-3 shadow-sm w-full bg-background border border-gray-200 rounded-2xl">
            {/* 1: Lançamentos */}
            <div className="flex flex-col items-center justify-center flex-1">
              <span className="text-[12px] sm:text-[14px] text-gray-700 font-bold whitespace-nowrap">Lançamentos</span>
              <span className="text-xs sm:text-sm font-bold text-gray-700 whitespace-nowrap">{summary.count} itens</span>
            </div>

            {/* 2: Receitas / Valor Pago */}
            <div className="flex flex-col items-center justify-center flex-1 border-l border-gray-300">
              <span className="text-[12px] sm:text-[14px] text-gray-700 font-bold whitespace-nowrap">
                {filterType === 'expense' ? 'Valor Pago' : 'Receitas'}
              </span>
              <span className="text-xs sm:text-sm font-bold text-success whitespace-nowrap">
                {formatCurrency(filterType === 'expense' ? summary.paidExpense : summary.income, !isMobile)}
              </span>
            </div>

            {/* 3: Despesas / Pendente */}
            <div className="flex flex-col items-center justify-center flex-1 border-l border-gray-300">
              <span className="text-[12px] sm:text-[14px] text-gray-700 font-bold whitespace-nowrap">
                {filterType === 'income' ? 'Pendente' : 'Despesas'}
              </span>
              <span className={cn(
                "text-xs sm:text-sm font-bold whitespace-nowrap",
                filterType === 'income' ? "text-orange-500" : "text-destructive"
              )}>
                {formatCurrency(filterType === 'income' ? summary.pendingIncome : summary.expense, !isMobile)}
              </span>
            </div>

            {/* 4: Saldo / Recebidas */}
            <div className="flex flex-col items-center justify-center flex-1 border-l border-gray-300">
              <span className="text-[12px] sm:text-[14px] text-gray-700 font-bold whitespace-nowrap">Saldo</span>
              <span className={cn(
                "text-xs sm:text-sm font-black tracking-tight whitespace-nowrap",
                filterType === 'expense'
                  ? (accumulatedValue > 0 ? "text-destructive" : "text-primary")
                  : filterType === 'income'
                    ? "text-primary"
                    : (accumulatedValue >= 0 ? "text-primary" : "text-destructive")
              )}>
                {formatCurrency(accumulatedValue, !isMobile)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};