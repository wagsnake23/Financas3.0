import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Transaction, AppCategory } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { format, isValid, setDate, getMonth, getYear, addMonths, endOfMonth } from "date-fns"; // Adicionado endOfMonth
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import TransactionRow from "./TransactionRow";
import { MaterializedRecurringTransaction, useRecurringEntries } from "@/hooks/useRecurringEntries";
import { useNavigate } from "react-router-dom";
import { CreditCardInvoiceSummary } from "./CreditCardInvoiceSummary"; // NOVO: Importar CreditCardInvoiceSummary

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
  onDeleteTransaction: (id: string, type: "income" | "expense", isFixed?: boolean) => void;
  onEditTransaction: (transaction: Transaction) => void;
  allCategories: AppCategory[];
  cartoes: Tables<'cartoes'>[];
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  disableFilters?: boolean;
  markMonthPaid: ReturnType<typeof useRecurringEntries>['markMonthPaid'];
  filterPaymentOptionId: string;
  setFilterPaymentOptionId: (cardId: string) => void;
  selectedMonth: Date;
  loadingPayInvoice: boolean;
  setLoadingPayInvoice: (loading: boolean) => void;
}

const UNSELECTED_VALUE = "unselected";

// Helper function to validate if a string is a UUID
const isValidUuid = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export const TransactionList = ({
  transactions, 
  onDeleteTransaction, 
  onEditTransaction, 
  allCategories,
  cartoes,
  isMobile,
  queryClient,
  user,
  disableFilters = false,
  markMonthPaid,
  filterPaymentOptionId,
  setFilterPaymentOptionId,
  selectedMonth,
  loadingPayInvoice,
  setLoadingPayInvoice,
}: TransactionListProps) => {
  console.log("TransactionList: User prop received:", user?.id, "Is user null?", !user);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const paymentFilterOptions = useMemo(() => {
    const options = [
      { value: "all", label: "Todas as formas de pagamento" },
      { value: "dinheiro", label: "Dinheiro" },
      { value: "pix", label: "Pix" },
    ];
    cartoes.forEach(card => {
      options.push({
        value: card.id,
        label: `Cartão: ${card.nome} (****${card.ultimos_digitos})`
      });
    });
    return options;
  }, [cartoes]);

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

      console.log(`TransactionList: Filtering transaction ID: ${transaction.id}, Type: ${transaction.type}, Desc: ${transaction.description}, IsRecurring: ${transaction.isRecurring}, Date: ${transaction.date}, FormaPagamento: ${transaction.forma_pagamento}, CartaoId: ${transaction.cartao_id} -> MatchesSearch: ${matchesSearch}, MatchesType: ${matchesType}, MatchesCategory: ${matchesCategory}, MatchesPaymentOption: ${matchesPaymentOption}, FINAL: ${finalResult}`);

      return finalResult;
    });
  }, [transactions, searchTerm, filterType, filterCategory, filterPaymentOptionId, isMobile]);

  const accumulatedValue = useMemo(() => {
    return filteredTransactions.reduce((sum, transaction) => {
      return sum + (transaction.type === "income" ? transaction.amount : -transaction.amount);
    }, 0);
  }, [filteredTransactions]);

  // NOVO: Calcular totais para o resumo da fatura do cartão
  const { totalPaidCard, totalPendingCard, totalCardExpenses } = useMemo(() => {
    let paid = 0;
    let pending = 0;
    filteredTransactions
      .filter(t => t.type === "expense") // Apenas despesas
      .forEach(transaction => {
        if (transaction.status === "Recebida") { // "Recebida" para despesas significa "paga"
          paid += transaction.amount;
        } else {
          pending += transaction.amount;
        }
      });
    return { totalPaidCard: paid, totalPendingCard: pending, totalCardExpenses: paid + pending };
  }, [filteredTransactions]);


  const getCategoryDisplayName = (categoryId: string) => {
    const category = allCategories.find(cat => cat.id === categoryId);
    return category?.nome || categoryId;
  };

  const selectableCategories = useMemo(() => {
    if (filterType === "income") {
      return allCategories.filter(cat => cat.parent_id === 'receitas_e_investimentos');
    } else { // This covers "expense" and "all"
      return allCategories.filter(cat => cat.parent_id !== 'receitas_e_investimentos');
    }
  }, [allCategories, filterType]);

  const handlePayInvoice = async () => {
    if (!user) {
      toast.error("Usuário não autenticado. Por favor, faça login novamente.");
      return;
    }
    if (!isValidUuid(filterPaymentOptionId)) {
      toast.error("Selecione um cartão de crédito válido para pagar a fatura.");
      return;
    }
    if (!isValid(selectedMonth)) {
      toast.error("Data do mês selecionado é inválida. Por favor, selecione um mês válido.");
      console.error("Invalid selectedMonth in handlePayInvoice (using date-fns isValid):", selectedMonth);
      return;
    }

    setLoadingPayInvoice(true);

    try {
      const installmentIdsToUpdate = filteredTransactions
        .filter(t => t.type === "expense" && t.status !== "Recebida")
        .map(t => t.id);

      if (installmentIdsToUpdate.length === 0) {
        toast.info("Nenhuma despesa pendente encontrada para este cartão no mês selecionado.");
        setLoadingPayInvoice(false);
        return;
      }

      const { error } = await supabase
        .from("despesas_parcelas")
        .update({
          pago: true,
          data_pagamento: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        })
        .in("id", installmentIdsToUpdate);

      if (error) {
        throw error;
      }

      toast.success("Fatura paga com sucesso!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });

      queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["revenues", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["recurringEntries", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["recurringExceptions", user?.id] });
      queryClient.invalidateQueries();
      
    } catch (error: any) {
      console.error("Erro ao pagar fatura:", error);
      toast.error("Erro ao pagar fatura.", { description: error.message });
    } finally {
      setLoadingPayInvoice(false);
    }
  };

  // Calcular a data de vencimento da fatura e o dia de fechamento
  const cardDetails = useMemo(() => {
    if (!isValidUuid(filterPaymentOptionId) || !isValid(selectedMonth)) {
      return null;
    }
    const selectedCard = cartoes.find(card => card.id === filterPaymentOptionId);
    if (!selectedCard) {
      return null;
    }

    const currentYear = getYear(selectedMonth);
    const currentMonthIndex = getMonth(selectedMonth); // 0-indexed

    // Calculate the closing date for the invoice that *covers* transactions up to the selected month's closing day.
    // This means the closing date is in the `selectedMonth`.
    let closingDateForDisplay = setDate(new Date(currentYear, currentMonthIndex), selectedCard.dia_fechamento);
    // Handle cases where dia_fechamento is greater than days in month (e.g., 31 in Feb)
    if (!isValid(closingDateForDisplay)) {
      closingDateForDisplay = setDate(endOfMonth(new Date(currentYear, currentMonthIndex)), selectedCard.dia_fechamento);
    }
    const formattedClosingDate = isValid(closingDateForDisplay) ? format(closingDateForDisplay, "dd/MM", { locale: ptBR }) : null;

    // Calculate the due date for this invoice. It will be in the *next* month.
    let dueDateForDisplay = setDate(new Date(currentYear, currentMonthIndex), selectedCard.dia_vencimento);
    dueDateForDisplay = addMonths(dueDateForDisplay, 1); // Add 1 month for the due date
    // Handle cases where dia_vencimento is greater than days in next month
    if (!isValid(dueDateForDisplay)) {
      dueDateForDisplay = setDate(endOfMonth(addMonths(new Date(currentYear, currentMonthIndex), 1)), selectedCard.dia_vencimento);
    }
    const formattedDueDate = isValid(dueDateForDisplay) ? format(dueDateForDisplay, "dd/MM", { locale: ptBR }) : null;

    return {
      closingDay: selectedCard.dia_fechamento,
      formattedClosingDate,
      formattedDueDate,
    };
  }, [filterPaymentOptionId, selectedMonth, cartoes]);

  console.log("TransactionList: Raw transactions count (for selected month):", transactions.length);
  console.log("TransactionList: Filtered transactions count (after all filters):", filteredTransactions.length);

  return (
    <div className={cn("p-6", isMobile && "p-0")}>
      
      <div className={cn("grid gap-4 mb-0", isMobile ? "grid-cols-2 gap-2" : "grid-cols-4")}>
        <Select value={filterType} onValueChange={setFilterType} disabled={disableFilters}>
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="income">Receita</SelectItem>
            <SelectItem value="expense">Despesa</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={setFilterCategory} disabled={disableFilters}>
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Subcategoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Subcategoria</SelectItem>
            {selectableCategories
              .filter(cat => cat.id !== "") 
              .map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <span className="flex items-center gap-2">
                    <span>{cat.icone}</span>
                    <span>{getCategoryDisplayName(cat.id)}</span>
                  </span>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {/* Payment Option Select */}
        <Select value={filterPaymentOptionId} onValueChange={setFilterPaymentOptionId} disabled={disableFilters}
                className="rounded-xl">
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Forma de Pagamento" />
          </SelectTrigger>
          <SelectContent>
            {paymentFilterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Conditional Button and Due Date for Credit Card */}
        {isValidUuid(filterPaymentOptionId) ? (
          <div className={cn(
            "flex flex-col items-center justify-center",
            isMobile ? "col-span-1" : "col-span-1" // Always 1 col for this block
          )}>
            <Button
              variant="secondary"
              onClick={handlePayInvoice}
              className="w-full rounded-xl"
              disabled={loadingPayInvoice || disableFilters}
            >
              <DynamicIcon name="CreditCard" className="mr-2 h-4 w-4" />
              {loadingPayInvoice ? "Pagando..." : "Pagar Fatura"}
            </Button>
            {cardDetails?.formattedDueDate && (
              <p className={cn("text-xs text-muted-foreground mt-1", isMobile && "text-[0.6rem]")}>
                Vencimento: {cardDetails.formattedDueDate}
              </p>
            )}
          </div>
        ) : (
          // Se nenhum cartão de crédito for selecionado, este slot permanece vazio no desktop
          // para manter a estrutura da grade.
          <div className={cn("hidden", !isMobile && "block")}></div> 
        )}
      </div>

      {/* NEW: Card Details Display */}
      {isValidUuid(filterPaymentOptionId) && cardDetails && (
        <div className={cn(
          "grid grid-cols-2 gap-4 mt-4 p-4 bg-soft-purple/20 border border-soft-purple rounded-xl shadow-sm",
          isMobile && "gap-2 mt-3 p-3 text-sm"
        )}>
          <div className="flex items-center gap-2">
            <DynamicIcon name="CalendarOff" className={cn("h-5 w-5 text-primary", isMobile && "h-4 w-4")} />
            <div>
              <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Fechamento:</p>
              <p className={cn("font-semibold", isMobile && "text-xs")}>{cardDetails.formattedClosingDate || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DynamicIcon name="Calendar" className={cn("h-5 w-5 text-primary", isMobile && "h-4 w-4")} />
            <div>
              <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Vencimento:</p>
              <p className={cn("font-semibold", isMobile && "text-xs")}>{cardDetails.formattedDueDate || 'N/A'}</p>
            </div>
          </div>
        </div>
      )}

      {/* NOVO: Resumo da Fatura do Cartão */}
      {isValidUuid(filterPaymentOptionId) && (
        <div className="mt-4"> {/* Adicionado margem superior */}
          <CreditCardInvoiceSummary
            totalPaid={totalPaidCard}
            totalPending={totalPendingCard}
            totalCardExpenses={totalCardExpenses}
            isMobile={!!isMobile}
            formattedDueDate={cardDetails?.formattedDueDate || null} {/* Passando a data de vencimento */}
          />
        </div>
      )}

      <div className={cn(
        "rounded-xl border overflow-hidden shadow-sm mt-4", // Adicionado mt-4 aqui
        isMobile ? "max-h-[320px] overflow-x-auto overflow-y-auto" : "max-h-[60vh] overflow-x-auto overflow-y-auto" // Ajustado para 320px em mobile
      )}>
        <Table>
          {/* REMOVIDO: TableHeader */}
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isMobile ? 5 : 7} className="text-center py-8 text-muted-foreground">
                  Nenhum lançamento encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => (
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
                  markMonthPaid={markMonthPaid}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Accumulated Value - Reposicionado e estilizado como label */}
      <div className="flex justify-end mb-0 mt-4 pr-5"> {/* Alterado para justify-end e adicionado pr-5 */}
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Valor Total:</p>
          <p className={cn(
            "text-sm font-bold",
            accumulatedValue >= 0 ? "text-success" : "text-destructive"
          )}>
            R$ {accumulatedValue.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
};