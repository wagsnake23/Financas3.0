import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Transaction, AppCategory } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { format, isValid, setDate, getMonth, getYear } from "date-fns"; // Adicionado setDate, getMonth, getYear
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import TransactionRow from "./TransactionRow";
import { MaterializedRecurringTransaction, useRecurringEntries } from "@/hooks/useRecurringEntries";
import { useNavigate } from "react-router-dom"; // Importar useNavigate

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

  const getCategoryDisplayName = (categoryId: string) => {
    const category = allCategories.find(cat => cat.id === categoryId);
    return category?.nome || categoryId;
  };

  const selectableCategories = useMemo(() => {
    if (filterType === "income") {
      return allCategories.filter(cat => cat.parent_id === 'receitas_e_investimentos');
    } else if (filterType === "expense") {
      return allCategories.filter(cat => cat.parent_id !== 'receitas_e_investimentos');
    }
    return allCategories;
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

  // Calcular a data de vencimento da fatura
  const invoiceDueDate = useMemo(() => {
    if (!isValidUuid(filterPaymentOptionId) || !isValid(selectedMonth)) {
      return null;
    }
    const selectedCard = cartoes.find(card => card.id === filterPaymentOptionId);
    if (!selectedCard) {
      return null;
    }

    const currentYear = getYear(selectedMonth);
    const currentMonthIndex = getMonth(selectedMonth); // 0-indexed

    let dueDate = setDate(new Date(currentYear, currentMonthIndex), selectedCard.dia_vencimento);

    // Se o dia de vencimento já passou no mês atual, a fatura é do próximo mês
    // Ex: Mês selecionado é Janeiro, dia de vencimento é 5. Se hoje é 10 de Janeiro, a fatura de Janeiro já venceu.
    // A próxima fatura a ser paga (que inclui as despesas do mês selecionado) vencerá em Fevereiro.
    // No entanto, a lógica de "pagar fatura" se refere às despesas *do mês selecionado*.
    // A data de vencimento exibida deve ser a do mês *seguinte* ao mês de referência das despesas.
    // Ex: Despesas de Janeiro vencem em Fevereiro.
    // Então, se selectedMonth é Janeiro, a data de vencimento é dia_vencimento de Fevereiro.
    
    // Para simplificar, vamos exibir a data de vencimento no mês seguinte ao `selectedMonth`
    // porque as despesas do `selectedMonth` geralmente vencem no mês seguinte.
    dueDate = addMonths(dueDate, 1); // Adiciona 1 mês para refletir o vencimento da fatura do mês selecionado

    return isValid(dueDate) ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : null;
  }, [filterPaymentOptionId, selectedMonth, cartoes]);

  console.log("TransactionList: Raw transactions count (for selected month):", transactions.length);
  console.log("TransactionList: Filtered transactions count (after all filters):", filteredTransactions.length);

  return (
    <div className={cn("p-6", isMobile && "p-0")}>
      
      <div className={cn("grid mb-6", isMobile ? "grid-cols-2 gap-2 mb-4" : "grid-cols-4 gap-4")}>
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

        {isMobile && isValidUuid(filterPaymentOptionId) ? (
          <>
            <Select value={filterPaymentOptionId} onValueChange={setFilterPaymentOptionId} disabled={disableFilters}
                    className="rounded-xl col-span-1">
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

            <div className="flex flex-col items-center justify-center col-span-1"> {/* Container para botão e data */}
              <Button
                variant="secondary"
                onClick={handlePayInvoice}
                className="w-full rounded-xl"
                disabled={loadingPayInvoice || disableFilters}
              >
                <DynamicIcon name="CreditCard" className="mr-2 h-4 w-4" />
                {loadingPayInvoice ? "Pagando..." : "Pagar Fatura"}
              </Button>
              {invoiceDueDate && (
                <span className="text-xs text-muted-foreground mt-1">
                  Vencimento: {invoiceDueDate}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className={cn("col-span-full flex flex-col gap-2", !isMobile && "grid grid-cols-2 gap-4")}> {/* Ajustado para desktop */}
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
            {isValidUuid(filterPaymentOptionId) && (
              <div className="flex flex-col items-center justify-center">
                <Button
                  variant="secondary"
                  onClick={handlePayInvoice}
                  className="w-full rounded-xl"
                  disabled={loadingPayInvoice || disableFilters}
                >
                  <DynamicIcon name="CreditCard" className="mr-2 h-4 w-4" />
                  {loadingPayInvoice ? "Pagando..." : "Pagar Fatura"}
                </Button>
                {invoiceDueDate && (
                  <span className="text-xs text-muted-foreground mt-1">
                    Vencimento: {invoiceDueDate}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div className={cn(
          "p-2 rounded-xl text-right",
          isMobile ? "py-1.5 px-3 col-span-full" : "col-span-1"
        )}>
          <p className="text-xs text-muted-foreground">Valor Total:</p>
          <p className={cn(
            "text-base font-bold",
            accumulatedValue >= 0 ? "text-success" : "text-destructive"
          )}>
            R$ {accumulatedValue.toFixed(2)}
          </p>
        </div>
      </div>

      <div className={cn(
        "rounded-xl border overflow-hidden shadow-sm",
        isMobile ? "max-h-[50vh] overflow-x-auto overflow-y-auto" : "max-h-[60vh] overflow-x-auto overflow-y-auto"
      )}>
        <Table>
          <TableHeader className="sticky top-0 bg-soft-blue z-10">
            <TableRow>
              <TableHead className="py-1 px-2 min-w-[70px]">Data</TableHead>
              {!isMobile && <TableHead className="py-1 px-2 min-w-[60px]">Tipo</TableHead>}
              <TableHead className="py-1 px-2 min-w-[80px]">Subcategoria</TableHead>
              {!isMobile && <TableHead className="py-1 px-2 min-w-[100px]">Descrição</TableHead>}
              <TableHead className="py-1 px-2 text-right min-w-[80px]">Valor</TableHead>
              <TableHead className="py-1 px-2 text-center min-w-[50px]">Status</TableHead>
              <TableHead className="py-1 px-2 text-right min-w-[50px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
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
    </div>
  );
};