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
import { MaterializedRecurringTransaction, useRecurringEntries } from "@/hooks/useRecurringEntries"; // Importar useRecurringEntries para o tipo

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
  allCategories: AppCategory[]; // Agora contém apenas subcategorias
  cartoes: Tables<'cartoes'>[];
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  disableFilters?: boolean;
  markMonthPaid: ReturnType<typeof useRecurringEntries>['markMonthPaid']; // Re-adicionado
  // filterCardId: string; // Removido
  // setFilterCardId: (cardId: string) => void; // Removido
}

export const TransactionList = ({
  transactions, 
  onDeleteTransaction, 
  onEditTransaction, 
  allCategories, // Usar allCategories diretamente (já são subcategorias)
  cartoes,
  isMobile,
  queryClient,
  user,
  disableFilters = false,
  markMonthPaid, // Re-adicionado
  // filterCardId, // Removido
  // setFilterCardId, // Removido
}: TransactionListProps) => {
  console.log("TransactionList: User prop received:", user?.id, "Is user null?", !user);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const filteredTransactions = useMemo(() => {
    console.log("TransactionList: filteredTransactions useMemo re-running...");
    
    return transactions.filter(transaction => {
      const matchesSearch = isMobile ? true : transaction.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || transaction.type === filterType;
      const matchesCategory = filterCategory === "all" || transaction.category === filterCategory;
      
      // A lógica de filtro de cartão de crédito foi removida daqui
      const finalResult = matchesSearch && matchesType && matchesCategory;

      console.log(`TransactionList: Filtering transaction ID: ${transaction.id}, Type: ${transaction.type}, Desc: ${transaction.description}, IsRecurring: ${transaction.isRecurring}, Date: ${transaction.date}, FormaPagamento: ${transaction.forma_pagamento}, CartaoId: ${transaction.cartao_id} -> MatchesSearch: ${matchesSearch}, MatchesType: ${matchesType}, MatchesCategory: ${matchesCategory}, FINAL: ${finalResult}`);

      return finalResult;
    });
  }, [transactions, searchTerm, filterType, filterCategory, isMobile]); // Removido filterCardId das dependências

  const accumulatedValue = useMemo(() => {
    return filteredTransactions.reduce((sum, transaction) => {
      return sum + (transaction.type === "income" ? transaction.amount : -transaction.amount);
    }, 0);
  }, [filteredTransactions]);

  const getCategoryDisplayName = (categoryId: string) => {
    const category = allCategories.find(cat => cat.id === categoryId);
    // Como agora só temos subcategorias, não precisamos mais da hierarquia "Pai > Filho"
    return category?.nome || categoryId;
  };

  // `allCategories` já são as subcategorias.
  // Filtrar para obter apenas as subcategorias relevantes para o filtro de tipo.
  const selectableCategories = useMemo(() => {
    if (filterType === "income") {
      return allCategories.filter(cat => cat.parent_id === 'receitas_e_investimentos');
    } else if (filterType === "expense") {
      return allCategories.filter(cat => cat.parent_id !== 'receitas_e_investimentos');
    }
    return allCategories; // Se "all", retorna todas as subcategorias
  }, [allCategories, filterType]);

  console.log("TransactionList: Raw transactions count (for selected month):", transactions.length);
  console.log("TransactionList: Filtered transactions count (after all filters):", filteredTransactions.length);

  return (
    <div className={cn("p-6", isMobile && "p-0")}>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {!isMobile && (
          <div className="relative">
            <DynamicIcon name="Search" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-xl"
              disabled={disableFilters}
            />
          </div>
        )}

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
            <SelectValue placeholder="Subcategoria" /> {/* Placeholder atualizado */}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as subcategorias</SelectItem> {/* Item atualizado */}
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

        {/* O filtro para Cartão de Crédito foi removido daqui */}
      </div>

      <div className={cn("mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", isMobile && "flex-col items-stretch mb-0")}>
        <div className={cn(
          "p-2 rounded-xl border flex-1",
          isMobile && "py-1.5 px-3",
          accumulatedValue >= 0 ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20"
        )}>
          <p className="text-xs text-muted-foreground">Valor Acumulado (Filtro Atual):</p>
          <p className={cn(
            "text-lg font-bold",
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
              <TableHead className="py-1 px-2 min-w-[80px]">Subcategoria</TableHead> {/* Título atualizado */}
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
                  markMonthPaid={markMonthPaid} // Re-adicionado
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};