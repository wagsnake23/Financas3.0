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
import { MaterializedRecurringTransaction } from "@/hooks/useRecurringEntries";

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
  filterPaymentMethod: string;
  setFilterPaymentMethod: (method: string) => void;
  isMobile?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  user: User | null;
  rawExpenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_fixed' | 'recurrence_frequency' | 'recurrence_installments_count'> | null })[];
  selectedMonth: Date; // Reintroduzido
}

export const TransactionList = ({
  transactions, 
  onDeleteTransaction, 
  onEditTransaction, 
  allCategories, 
  cartoes,
  filterPaymentMethod,
  setFilterPaymentMethod,
  isMobile,
  queryClient,
  user,
  rawExpenseInstallments,
  selectedMonth // Reintroduzido
}: TransactionListProps) => {
  console.log("TransactionList: User prop received:", user?.id, "Is user null?", !user);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const filteredTransactions = useMemo(() => {
    const startOfSelectedMonth = startOfMonth(selectedMonth);
    const endOfSelectedMonth = endOfMonth(selectedMonth);

    return transactions.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      const matchesMonth = isWithinInterval(transactionDate, { start: startOfSelectedMonth, end: endOfSelectedMonth });
      
      const matchesSearch = isMobile ? true : transaction.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || transaction.type === filterType;
      const matchesCategory = filterCategory === "all" || transaction.category === filterCategory;
      
      let matchesPaymentMethod = true;
      if (filterPaymentMethod !== "all") {
        if (transaction.type === "income" || transaction.isRecurring) {
          matchesPaymentMethod = true; 
        } else {
          if (filterPaymentMethod === "dinheiro" || filterPaymentMethod === "pix" || filterPaymentMethod === "boleto") {
            matchesPaymentMethod = transaction.forma_pagamento === filterPaymentMethod;
          } else if (filterPaymentMethod.startsWith("cartao_")) {
            const cardId = filterPaymentMethod.split("_")[1];
            matchesPaymentMethod = transaction.forma_pagamento === "cartao" && transaction.cartao_id === cardId;
          }
        }
      }

      const finalResult = matchesMonth && matchesSearch && matchesType && matchesCategory && matchesPaymentMethod;
      console.log("Filtering transaction:", {
        id: transaction.id,
        type: transaction.type,
        isRecurring: transaction.isRecurring,
        date: transaction.date,
        matchesMonth,
        description: transaction.description,
        matchesSearch,
        matchesType,
        matchesCategory,
        matchesPaymentMethod,
        filterPaymentMethod,
        finalResult
      });

      return finalResult;
    });
  }, [transactions, searchTerm, filterType, filterCategory, filterPaymentMethod, isMobile, selectedMonth]); // selectedMonth adicionado às dependências

  const accumulatedValue = useMemo(() => {
    return filteredTransactions.reduce((sum, transaction) => {
      return sum + (transaction.type === "income" ? transaction.amount : -transaction.amount);
    }, 0);
  }, [filteredTransactions]);

  const getCategoryDisplayName = (categoryId: string) => {
    const category = allCategories.find(cat => cat.id === categoryId);
    if (!category) return categoryId;

    if (category.parent_id) {
      const parent = allCategories.find(p => p.id === category.parent_id);
      return `${parent?.nome || 'Categoria Principal'} > ${category.nome}`;
    }
    return category.nome;
  };

  const selectableCategories = useMemo(() => {
    return allCategories.filter(cat => 
      cat.parent_id !== null || 
      cat.id === 'receitas_e_investimentos' || 
      cat.id === 'moradia' || 
      cat.id === 'transporte' || 
      cat.id === 'alimentacao' || 
      cat.id === 'saude' || 
      cat.id === 'educacao' || 
      cat.id === 'lazer' || 
      cat.id === 'pessoais' || 
      cat.id === 'obrigacoes_financeiras' || 
      cat.id === 'trabalho_negocio' || 
      cat.id === 'familia_filhos'
    );
  }, [allCategories]);

  const selectedCardId = filterPaymentMethod.startsWith("cartao_") ? filterPaymentMethod.split("_")[1] : null;
  const selectedCard = useMemo(() => {
    return cartoes.find(card => card.id === selectedCardId);
  }, [cartoes, selectedCardId]);

  const invoiceDetails = useMemo(() => {
    if (!selectedCard) return null;

    // Usar o selectedMonth para determinar o mês da fatura
    const currentMonthForInvoice = selectedMonth; 
    const currentDay = currentMonthForInvoice.getDate();
    
    let invoiceMonthDate = currentMonthForInvoice;

    if (currentDay > selectedCard.dia_fechamento) {
      invoiceMonthDate = addMonths(currentMonthForInvoice, 1);
    }

    const invoiceClosingDate = new Date(invoiceMonthDate.getFullYear(), invoiceMonthDate.getMonth(), selectedCard.dia_fechamento);
    const invoiceDueDate = new Date(addMonths(invoiceMonthDate, 1).getFullYear(), addMonths(invoiceMonthDate, 1).getMonth(), selectedCard.dia_vencimento);

    return {
      cardName: selectedCard.nome,
      invoiceMonth: format(invoiceMonthDate, "MMMM", { locale: ptBR }),
      dueDate: format(invoiceDueDate, "dd/MM", { locale: ptBR }),
      invoiceMonthDate: invoiceMonthDate,
    };
  }, [selectedCard, selectedMonth]); // selectedMonth adicionado às dependências

  const handlePayInvoice = async () => {
    if (!selectedCard || !invoiceDetails || !user?.id) {
      toast.error("Não foi possível processar o pagamento da fatura. Dados incompletos.");
      return;
    }

    const invoiceMonthStart = startOfMonth(invoiceDetails.invoiceMonthDate);
    const invoiceMonthEnd = endOfMonth(invoiceDetails.invoiceMonthDate);

    const installmentsToPay = rawExpenseInstallments.filter(p => {
      const installmentDate = new Date(p.vencimento);
      return (
        p.despesas?.cartao_id === selectedCard.id &&
        !p.pago &&
        isWithinInterval(installmentDate, { start: invoiceMonthStart, end: invoiceMonthEnd })
      );
    });

    if (installmentsToPay.length === 0) {
      toast.info(`Não há parcelas pendentes para o cartão ${selectedCard.nome} na fatura de ${invoiceDetails.invoiceMonth}.`);
      return;
    }

    const installmentIdsToUpdate = installmentsToPay.map(p => p.id);
    const currentTimestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");

    const { error } = await supabase
      .from("despesas_parcelas")
      .update({
        pago: true,
        data_pagamento: currentTimestamp,
      })
      .in("id", installmentIdsToUpdate);

    if (error) {
      toast.error("Erro ao pagar a fatura do cartão", { description: error.message });
      console.error("Supabase error paying invoice:", error);
    } else {
      toast.success(`Fatura do cartão ${selectedCard.nome} (${invoiceDetails.invoiceMonth}) paga com sucesso!`, {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success))' }
      });
      queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
    }
  };

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
              className="pl-10"
            />
          </div>
        )}

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="income">Receita</SelectItem>
            <SelectItem value="expense">Despesa</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
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
      </div>

      <div className="mb-6">
        <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
          <SelectTrigger>
            <SelectValue placeholder="Forma de Pagamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as formas de pagamento</SelectItem>
            <SelectItem value="dinheiro">Dinheiro</SelectItem>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="boleto">Boleto</SelectItem>
            {cartoes.map(card => (
              <SelectItem key={card.id} value={`cartao_${card.id}`}>
                Cartão: {card.nome} ({card.banco} ****{card.ultimos_digitos})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isMobile && selectedCard && invoiceDetails && (
        <div className="mb-4">
          <Button 
            variant="outline" 
            className="h-auto py-2 text-sm w-3/4 mx-auto whitespace-normal rounded-xl"
            onClick={handlePayInvoice}
          >
            <span className="mr-2">💳</span>
            Pagar fatura {selectedCard.nome} ({invoiceDetails.invoiceMonth}) Venc: {invoiceDetails.dueDate}
          </Button>
        </div>
      )}

      <div className={cn("mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", isMobile && "flex-col items-stretch mb-0")}>
        <div className={cn(
          "p-2 rounded-lg border flex-1",
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

        {!isMobile && selectedCard && invoiceDetails && (
          <Button 
            variant="outline" 
            className="h-auto py-3"
            onClick={handlePayInvoice}
          >
            <span className="mr-2">💳</span>
            Pagar fatura {selectedCard.nome} ({invoiceDetails.invoiceMonth}) Venc: {invoiceDetails.dueDate}
          </Button>
        )}
      </div>

      <div className={cn(
        "rounded-lg border overflow-hidden",
        isMobile ? "max-h-[50vh] overflow-x-auto overflow-y-auto" : "max-h-[60vh] overflow-x-auto overflow-y-auto"
      )}>
        <Table>
          <TableHeader className="sticky top-0 bg-soft-blue z-10">
            <TableRow>
              <TableHead className="py-1 px-2 min-w-[70px]">Data</TableHead>
              {!isMobile && <TableHead className="py-1 px-2 min-w-[60px]">Tipo</TableHead>}
              <TableHead className="py-1 px-2 min-w-[80px]">Categoria</TableHead>
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
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};