import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Transaction, AppCategory } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { format, addMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
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
  filterPaymentOptionId: string; // NOVO: Receber o estado do filtro
  setFilterPaymentOptionId: (cardId: string) => void; // NOVO: Receber o setter do filtro
  selectedMonth: Date; // NOVO: Recebendo selectedMonth
}

const UNSELECTED_VALUE = "unselected"; // Definir UNSELECTED_VALUE

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
  filterPaymentOptionId, // NOVO
  setFilterPaymentOptionId, // NOVO
  selectedMonth, // NOVO
}: TransactionListProps) => {
  console.log("TransactionList: User prop received:", user?.id, "Is user null?", !user);
  const navigate = useNavigate(); // Inicializar useNavigate
  const [searchTerm, setSearchTerm] = useState(""); // Manter searchTerm para a lógica de filtro, mas o input será removido
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  // Removido o estado local filterPaymentOptionId, agora ele vem das props

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
      // A busca por descrição só será aplicada se não for mobile, já que o campo será removido em desktop
      const matchesSearch = isMobile ? true : transaction.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || transaction.type === filterType;
      const matchesCategory = filterCategory === "all" || transaction.category === filterCategory;
      
      let matchesPaymentOption = true;
      if (filterPaymentOptionId !== "all") {
        if (filterPaymentOptionId === "dinheiro") {
          matchesPaymentOption = transaction.forma_pagamento === "dinheiro";
        } else if (filterPaymentOptionId === "pix") {
          matchesPaymentOption = transaction.forma_pagamento === "pix";
        } else if (isValidUuid(filterPaymentOptionId)) { // Se for um ID de cartão
          matchesPaymentOption = transaction.forma_pagamento === "cartao" && transaction.cartao_id === filterPaymentOptionId;
        } else {
          // Fallback para outras formas de pagamento que não sejam dinheiro, pix ou cartão (ex: boleto)
          // Se o filtro for "boleto", por exemplo, e não for um UUID
          matchesPaymentOption = transaction.forma_pagamento === filterPaymentOptionId;
        }
      }

      const finalResult = matchesSearch && matchesType && matchesCategory && matchesPaymentOption;

      console.log(`TransactionList: Filtering transaction ID: ${transaction.id}, Type: ${transaction.type}, Desc: ${transaction.description}, IsRecurring: ${transaction.isRecurring}, Date: ${transaction.date}, FormaPagamento: ${transaction.forma_pagamento}, CartaoId: ${transaction.cartao_id} -> MatchesSearch: ${matchesSearch}, MatchesType: ${matchesType}, MatchesCategory: ${matchesCategory}, MatchesPaymentOption: ${matchesPaymentOption}, FINAL: ${finalResult}`);

      return finalResult;
    });
  }, [transactions, searchTerm, filterType, filterCategory, filterPaymentOptionId, isMobile]); // Adicionar filterPaymentOptionId às dependências

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

  const handleViewInvoice = () => {
    if (isValidUuid(filterPaymentOptionId)) {
      const formattedMonth = format(selectedMonth, "yyyy-MM-dd");
      navigate(`/lancamentos?cardId=${filterPaymentOptionId}&month=${formattedMonth}`);
    } else {
      toast.error("Selecione um cartão de crédito válido para ver a fatura.");
    }
  };

  console.log("TransactionList: Raw transactions count (for selected month):", transactions.length);
  console.log("TransactionList: Filtered transactions count (after all filters):", filteredTransactions.length);

  return (
    <div className={cn("p-6", isMobile && "p-0")}>
      
      <div className={cn("grid mb-6", isMobile ? "grid-cols-2 gap-2 mb-4" : "grid-cols-4 gap-4")}> {/* Ajustado mb-6 para mb-4 em mobile */}
        {/* Campo de busca por descrição removido */}

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
            <SelectValue placeholder="Subcategoria" /> {/* Renomeado placeholder */}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Subcategoria</SelectItem> {/* Renomeado item "all" */}
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

        {/* Filtro de Forma de Pagamento/Cartão Combinado */}
        <Select value={filterPaymentOptionId} onValueChange={setFilterPaymentOptionId} disabled={disableFilters}
                className={cn(isMobile && "col-span-full")}> {/* Ocupa a linha inteira em mobile */}
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

        {/* NOVO: Pagar Fatura Button (conditional) e Valor Total */}
        {isMobile && isValidUuid(filterPaymentOptionId) ? (
          <>
            <Button
              variant="secondary"
              onClick={handleViewInvoice}
              className="w-full rounded-xl col-span-1" // col-span-1 para mobile
            >
              <DynamicIcon name="CreditCard" className="mr-2 h-4 w-4" />
              Pagar Fatura
            </Button>
            <div className={cn(
              "p-2 rounded-xl text-right col-span-1", // col-span-1 para mobile
              isMobile && "py-1.5 px-3"
            )}>
              <p className="text-xs text-muted-foreground">Valor Total:</p>
              <p className={cn(
                "text-base font-bold",
                accumulatedValue >= 0 ? "text-success" : "text-destructive"
              )}>
                R$ {accumulatedValue.toFixed(2)}
              </p>
            </div>
          </>
        ) : (
          // Se nenhum cartão selecionado ou não for mobile, Valor Total ocupa a largura total em mobile, ou sua largura normal em desktop
          <div className={cn(
            "p-2 rounded-xl text-right",
            isMobile ? "py-1.5 px-3 col-span-2" : "col-span-1" // col-span-2 para mobile se não houver botão, col-span-1 para desktop
          )}>
            <p className="text-xs text-muted-foreground">Valor Total:</p>
            <p className={cn(
              "text-base font-bold",
              accumulatedValue >= 0 ? "text-success" : "text-destructive"
            )}>
              R$ {accumulatedValue.toFixed(2)}
            </p>
          </div>
        )}
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