import { useState, useMemo, useEffect } from "react";
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
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import TransactionRow from "./TransactionRow";
import { useNavigate } from "react-router-dom";
import { CreditCardInvoiceSummary } from "@/components/CreditCardInvoiceSummary";
import { Database } from "@/integrations/supabase/types";
import { ArrowUp, ArrowDown } from "lucide-react"; // Importar ícones de seta

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
}

const UNSELECTED_VALUE = "unselected";
const toastDuration = 1000;
const toastSuccessStyle = { backgroundColor: '#F3FFF3', color: '#006000' };
const toastErrorStyle = { backgroundColor: '#F3FFF3', color: '#FF2929' };

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
}: TransactionListProps) => {
  console.log("TransactionList: User prop received:", user?.id, "Is user null?", !user);
  console.log("TransactionList: selectedMonth (top of component):", selectedMonth, "isValid:", isValid(selectedMonth));

  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<string | null>("date"); // Default sort by date
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc"); // Default sort direction

  const paymentFilterOptions = useMemo(() => {
    const options = [
      { value: "all", label: "Forma de Pagamento" },
      { value: "dinheiro", label: "💰 Dinheiro" },
      { value: "pix", label: "📲 Pix" },
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
      const matchesSearch = isMobile ? true : transaction.description.toLowerCase().includes(searchTerm.toLowerCase());
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

      console.log(`TransactionList: Filtering transaction ID: ${transaction.id}, Type: ${transaction.type}, Desc: ${transaction.description}, Date: ${transaction.date}, FormaPagamento: ${transaction.forma_pagamento}, CartaoId: ${transaction.cartao_id} -> MatchesSearch: ${matchesSearch}, MatchesType: ${matchesType}, MatchesCategory: ${matchesCategory}, MatchesPaymentOption: ${matchesPaymentOption}, FINAL: ${finalResult}`);

      return finalResult;
    });
  }, [transactions, searchTerm, filterType, filterCategory, filterPaymentOptionId, isMobile]);

  const getCategoryDisplayName = (categoryId: string) => {
    const category = allCategories.find(cat => cat.id === categoryId);
    return category?.nome || categoryId;
  };

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
        } else {
          acc.expense += t.amount;
        }
        acc.count += 1;
        return acc;
      },
      { income: 0, expense: 0, count: 0 }
    );
  }, [filteredTransactions]);

  const accumulatedValue = summary.income - summary.expense;

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
      toast.error("Usuário não autenticado. Por favor, faça login novamente.", { duration: toastDuration, style: toastErrorStyle });
      return;
    }
    if (!isValidUuid(filterPaymentOptionId)) {
      toast.error("Selecione um cartão de crédito válido para pagar a fatura.", { duration: toastDuration, style: toastErrorStyle });
      return;
    }
    if (!isValid(monthToValidate)) {
      toast.error("Data do mês selecionado é inválida. Por favor, selecione um mês válido.", { duration: toastDuration, style: toastErrorStyle });
      console.error("Invalid selectedMonth in handlePayInvoice (using date-fns isValid):", selectedMonth, "Validated object:", monthToValidate);
      return;
    }

    setLoadingPayInvoice(true);

    try {
      const installmentIdsToUpdate = filteredTransactions
        .filter(t => t.type === "expense" && t.status !== "Recebida")
        .map(t => t.id);

      if (installmentIdsToUpdate.length === 0) {
        toast.info("Nenhuma despesa pendente encontrada para este cartão no mês selecionado.", { duration: toastDuration });
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

      toast.success("Fatura paga com sucesso!", {
        style: toastSuccessStyle,
        duration: toastDuration
      });

      queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });

    } catch (error: any) {
      console.error("Erro ao pagar fatura:", error);
      toast.error("Erro ao pagar fatura.", { description: error.message, duration: toastDuration, style: toastErrorStyle });
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

  // Removido o slice para que todas as transações filtradas sejam exibidas e a rolagem funcione
  const transactionsToDisplay = sortedTransactions;

  return (
    <div className={cn("p-6", isMobile ? "p-0 flex-1 flex flex-col min-h-0 h-full" : "")}>

      {/* Filtros em Estilo Chips/Pills - App Bancário Moderno */}
      <div className={cn(
        "flex items-center gap-2 mb-2 px-4 overflow-x-auto no-scrollbar py-0.5 flex-nowrap shrink-0",
        !isMobile && "px-6 mb-6"
      )}>
        {/* Chip: Tipo */}
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger
            className={cn(
              "h-8 rounded-full px-4 text-xs font-semibold whitespace-nowrap transition-all shadow-none border",
              filterType !== "all"
                ? "bg-[#26A765] text-white hover:bg-[#26A765]/90 border-transparent"
                : "bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-300",
              hideTypeFilter && "hidden"
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
              "h-8 rounded-full px-4 text-xs font-semibold whitespace-nowrap transition-all shadow-none border",
              filterCategory !== "all"
                ? "bg-[#26A765] text-white hover:bg-[#26A765]/90 border-transparent"
                : "bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-300"
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
              "h-8 rounded-full px-4 text-xs font-semibold whitespace-nowrap transition-all shadow-none border",
              filterPaymentOptionId !== "all"
                ? "bg-[#26A765] text-white hover:bg-[#26A765]/90 border-transparent"
                : "bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-300"
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

      {isValidUuid(filterPaymentOptionId) && (
        <div className={cn("mt-4", isMobile && "w-[90%] mx-auto mt-0")}> {/* Removido a margem superior no mobile para aproximar dos filtros */}
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
        isMobile ? "flex-1 overflow-y-auto w-[92%] mx-auto mt-1 px-1 no-scrollbar" : ""
      )}>
        {isMobile ? (
          <div className="flex flex-col gap-1 pb-4">
            {transactionsToDisplay.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                <p className="text-muted-foreground font-medium">Nenhum lançamento encontrado</p>
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
        ) : (
          <div className="lancamentos-scroll-container">
            <Table className="lancamentos-table table-fixed border-separate border-spacing-0">
              <TableHeader className="lancamentos-table-header">
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
        "mt-auto pb-0 bg-transparent relative z-20",
        isMobile ? "w-full px-2 mb-6" : "px-4 w-full px-6 mb-8"
      )}>
        <div className={cn(
          "bg-gray-50 flex items-center justify-between w-full gap-2 pt-1.5 pb-3 px-4 shadow-sm border-t border-gray-300",
          !isMobile && "!max-w-[1200px] mx-auto rounded-none"
        )}>
          {/* 1: Lançamentos */}
          <div className="flex flex-col items-center justify-center flex-1">
            <span className="text-[12px] sm:text-[14px] text-gray-700 font-bold whitespace-nowrap">Lançamentos</span>
            <span className="text-xs sm:text-sm font-bold text-gray-700 whitespace-nowrap">{summary.count} itens</span>
          </div>

          {/* 2: Receitas */}
          <div className="flex flex-col items-center justify-center flex-1 border-l border-gray-300">
            <span className="text-[12px] sm:text-[14px] text-gray-700 font-bold whitespace-nowrap">Receitas</span>
            <span className="text-xs sm:text-sm font-bold text-success whitespace-nowrap">+ {formatCurrency(summary.income, !isMobile)}</span>
          </div>

          {/* 3: Despesas */}
          <div className="flex flex-col items-center justify-center flex-1 border-l border-gray-300">
            <span className="text-[12px] sm:text-[14px] text-gray-700 font-bold whitespace-nowrap">Despesas</span>
            <span className="text-xs sm:text-sm font-bold text-destructive whitespace-nowrap">- {formatCurrency(summary.expense, !isMobile)}</span>
          </div>

          {/* 4: Saldo */}
          <div className="flex flex-col items-center justify-center flex-1 border-l border-gray-300">
            <span className="text-[12px] sm:text-[14px] text-gray-700 font-bold whitespace-nowrap">Saldo</span>
            <span className={cn(
              "text-xs sm:text-sm font-black tracking-tight whitespace-nowrap",
              accumulatedValue >= 0 ? "text-primary" : "text-destructive"
            )}>
              {formatCurrency(accumulatedValue, !isMobile)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};