import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Transaction, AppCategory, TransactionType } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import { cn, isValidUuid, formatCurrency } from "@/lib/utils"; // Importar formatCurrency
import { Tables } from "@/integrations/supabase/types";
import { format, isValid, setDate, getMonth, getYear, addMonths, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import TransactionRow from "./TransactionRow";
import { useNavigate } from "react-router-dom";
import { CreditCardInvoiceSummary } from "./CreditCardInvoiceSummary";
import { Database } from "@/integrations/supabase/types"; // Importar Database para ReceitaStatus

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
  onDeleteTransaction: (id: string, type: "income" | "expense", deleteScope: "thisMonth" | "thisMonthForward" | "all" | "oneOff") => void; // Atualizado
  onEditTransaction: (transaction: Transaction) => void;
  allCategories: AppCategory[];
  cartoes: Tables<'cartoes'>[];
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  // Removido: disableFilters?: boolean;
  filterPaymentOptionId: string;
  setFilterPaymentOptionId: (cardId: string) => void;
  loadingPayInvoice: boolean; // NOVA PROP
  setLoadingPayInvoice: (loading: boolean) => void; // NOVA PROP
  setSelectedMonth: (month: Date) => void; // Adicionado
  onToggleTransactionStatus: (id: string, type: TransactionType, newStatus: ReceitaStatus) => void; // NOVA PROP
}

const UNSELECTED_VALUE = "unselected";
const toastDuration = 1000; // 1 segundo para todos os dispositivos
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
  // Removido: disableFilters = false,
  filterPaymentOptionId,
  setFilterPaymentOptionId,
  selectedMonth,
  loadingPayInvoice, // NOVO
  setLoadingPayInvoice, // NOVO
  setSelectedMonth, // Adicionado
  onToggleTransactionStatus, // NOVA PROP
}: TransactionListProps) => {
  console.log("TransactionList: User prop received:", user?.id, "Is user null?", !user);
  console.log("TransactionList: selectedMonth (top of component):", selectedMonth, "isValid:", isValid(selectedMonth));

  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const paymentFilterOptions = useMemo(() => {
    const options = [
      { value: "all", label: "Forma de Pagamento" }, // Alterado de "Tudo" para "Forma de Pagamento"
      { value: "dinheiro", label: "💰 Dinheiro" }, // Adicionado emoji
      { value: "pix", label: "📲 Pix" }, // Adicionado emoji
    ];
    cartoes.forEach(card => {
      options.push({
        value: card.id,
        label: `💳 Cartão: ${card.nome} (****${card.ultimos_digitos})` // Adicionado emoji
      });
    });
    return options;
  }, [cartoes]);

  // NEW: Effect to reset filterPaymentOptionId if the selected card is not found in cartoes
  useEffect(() => {
    if (isValidUuid(filterPaymentOptionId) && cartoes.length > 0) {
      const cardExists = cartoes.some(card => card.id === filterPaymentOptionId);
      if (!cardExists) {
        console.warn(`TransactionList: Selected card ID ${filterPaymentOptionId} not found in loaded cards. Resetting filter.`);
        setFilterPaymentOptionId("all");
        // Optionally, if the filter came from the URL, you might want to clear it from the URL too.
        // navigate('/lancamentos', { replace: true });
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
    // Create a new Date object from the current selectedMonth to ensure it's a valid Date instance
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
    if (!isValid(monthToValidate)) { // Use the new Date object for validation
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
          data_pagamento: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
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

  // Calcular a data de vencimento da fatura e o dia de fechamento
  const cardDetails = useMemo(() => {
    const monthForCardDetails = new Date(selectedMonth); // Ensure a fresh Date object
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
    const currentMonthIndex = getMonth(monthForCardDetails); // 0-indexed

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
      cardLastDigits: selectedCard.ultimos_digitos,
    };
  }, [filterPaymentOptionId, selectedMonth, cartoes]);

  // NEW: Calculate formatted invoice month
  const formattedInvoiceMonth = useMemo(() => {
    if (!isValid(selectedMonth)) return null;
    return format(selectedMonth, "MMMM yyyy", { locale: ptBR });
  }, [selectedMonth]);

  console.log("TransactionList: Raw transactions count (for selected month):", transactions.length);
  console.log("TransactionList: Filtered transactions count (after all filters):", filteredTransactions.length);

  // Determine if the pay invoice button should be disabled
  const disablePayInvoiceButton = useMemo(() => {
    if (!isValidUuid(filterPaymentOptionId)) return true; // No card selected
    if (loadingPayInvoice) return true; // Already loading
    // Check if there are any pending expenses for the selected card
    const hasPendingExpenses = filteredTransactions.some(t => 
      t.type === "expense" && 
      t.status !== "Recebida" && 
      t.forma_pagamento === "cartao" && 
      t.cartao_id === filterPaymentOptionId
    );
    return !hasPendingExpenses;
  }, [filterPaymentOptionId, loadingPayInvoice, filteredTransactions]);

  // Determine if "Todos os tipos" filter should be hidden
  const hideTypeFilter = isMobile && isValidUuid(filterPaymentOptionId); // Corrigido o nome da variável aqui

  return (
    <div className={cn("p-6", isMobile && "p-0")}>
      
      <div className={cn("grid gap-2 mb-0", isMobile ? "grid-cols-2" : "grid-cols-4")}> {/* Alterado para grid-cols-2 em mobile */}
        <Select value={filterType} onValueChange={setFilterType} 
                className={cn("rounded-xl", hideTypeFilter && "hidden")}> {/* Adicionado visibilidade condicional */}
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="income">
              <span className="flex items-center gap-2">
                <DynamicIcon name="💰" className="h-4 w-4" />
                Receita
              </span>
            </SelectItem>
            <SelectItem value="expense">
              <span className="flex items-center gap-2">
                <DynamicIcon name="💸" className="h-4 w-4" />
                Despesa
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={setFilterCategory} 
                className={cn("rounded-xl", isMobile && (hideTypeFilter ? "col-span-2" : "col-span-1"))}> {/* Ajustado col-span para mobile */}
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
        <Select value={filterPaymentOptionId} onValueChange={setFilterPaymentOptionId} 
                className={cn("rounded-xl", isMobile && "col-span-2")}> {/* Ajustado para col-span-2 em mobile */}
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

        {/* Este slot agora está vazio, pois o botão foi movido */}
        <div className={cn("hidden", !isMobile && "block")}></div> 
      </div>

      {/* Resumo da Fatura do Cartão (agora com o botão Pagar Fatura dentro) */}
      {isValidUuid(filterPaymentOptionId) && (
        <div className="mt-4">
          <CreditCardInvoiceSummary
            totalPaid={totalPaidCard}
            totalPending={totalPendingCard}
            totalCardExpenses={totalCardExpenses}
            isMobile={!!isMobile}
            formattedDueDate={cardDetails?.formattedDueDate || null}
            formattedClosingDate={cardDetails?.formattedClosingDate || null} // Passando a nova prop
            cardLastDigits={cardDetails?.cardLastDigits || null}
            invoiceMonth={formattedInvoiceMonth} 
            onPayInvoice={handlePayInvoice}
            loadingPayInvoice={loadingPayInvoice}
            disablePayInvoiceButton={disablePayInvoiceButton}
          />
        </div>
      )}

      <div className={cn(
        "rounded-xl border overflow-hidden shadow-sm mt-4",
        isMobile ? "max-h-[352px] overflow-y-auto" : "max-h-[60vh] overflow-x-auto overflow-y-auto" // Aplicado max-h para mobile
      )}>
        <Table>
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
                  onToggleStatus={onToggleTransactionStatus} // Passando a nova prop
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end mb-0 mt-0 pr-5">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Valor Total:</p>
          <p className={cn(
            "text-sm font-bold",
            accumulatedValue >= 0 ? "text-success" : "text-destructive"
          )}>
            {formatCurrency(accumulatedValue)}
          </p>
        </div>
      </div>
    </div>
  );
};