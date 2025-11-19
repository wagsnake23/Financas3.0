import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory } from "@/types/finance";
import { format, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MobileCreditCardExpensesProps {
  cartoes: Tables<'cartoes'>[];
  expenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagamento' | 'cartao_id' | 'is_fixed' | 'recurrence_frequency' | 'recurrence_installments_count'> | null })[];
  allCategories: AppCategory[];
  isMobile: boolean;
  selectedMonth: Date;
}

const UNSELECTED_VALUE = "unselected";

export const MobileCreditCardExpenses: React.FC<MobileCreditCardExpensesProps> = ({
  cartoes,
  expenseInstallments,
  allCategories,
  isMobile,
  selectedMonth,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string>(UNSELECTED_VALUE);

  const filteredExpenses = useMemo(() => {
    if (selectedCardId === UNSELECTED_VALUE) return [];

    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    return expenseInstallments
      .filter(p => !p.despesas?.is_fixed) // Filter out legacy fixed expenses
      .filter(p => p.despesas?.forma_pagamento === "cartao" && p.despesas.cartao_id === selectedCardId)
      .filter(p => isWithinInterval(new Date(p.vencimento), { start: monthStart, end: monthEnd }))
      .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime());
  }, [expenseInstallments, selectedCardId, selectedMonth]);

  const { totalPaid, totalPending, totalCardExpenses } = useMemo(() => {
    let paid = 0;
    let pending = 0;
    filteredExpenses.forEach(installment => {
      if (installment.pago) {
        paid += installment.valor_parcela;
      } else {
        pending += installment.valor_parcela;
      }
    });
    return { totalPaid: paid, totalPending: pending, totalCardExpenses: paid + pending };
  }, [filteredExpenses]);

  const getCategoryDisplay = (categoryId: string | null) => {
    if (!categoryId) return { name: "Outros", icon: "MoreHorizontal" };
    const category = allCategories.find(cat => cat.id === categoryId);
    return {
      name: category?.nome || categoryId,
      icon: category?.icone || "MoreHorizontal",
    };
  };

  if (!isMobile) return null; // Only render on mobile

  return (
    <Card className={cn("p-4 animate-fade-in space-y-4 bg-card rounded-xl shadow-sm", isMobile && "p-3 space-y-3")}>
      <h2 className={cn("text-lg font-bold mb-2", isMobile && "text-base mb-1")}>Despesas do Cartão de Crédito</h2>

      {cartoes.length === 0 ? (
        <p className="text-muted-foreground text-center py-4 text-sm">Nenhum cartão de crédito cadastrado.</p>
      ) : (
        <Select value={selectedCardId} onValueChange={setSelectedCardId}>
          <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
            <SelectValue placeholder="Selecione um cartão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione um cartão</SelectItem>
            {cartoes.map(card => (
              <SelectItem key={card.id} value={card.id} className={cn(isMobile && "text-sm")}>
                {card.nome} (****{card.ultimos_digitos})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {selectedCardId !== UNSELECTED_VALUE && (
        <div className={cn("grid grid-cols-3 gap-2 text-center border-t pt-3 mt-3", isMobile && "gap-1 pt-2 mt-2")}>
          <div className={cn("flex flex-col items-center justify-center p-1", isMobile && "p-0.5")}>
            <DynamicIcon name="CheckCircle" className={cn("h-5 w-5 text-success mb-1", isMobile && "h-4 w-4 mb-0.5")} />
            <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Pago</p>
            <p className={cn("text-sm font-bold text-success", isMobile && "text-xs")}>R$ {totalPaid.toFixed(2)}</p>
          </div>
          <div className={cn("flex flex-col items-center justify-center p-1", isMobile && "p-0.5")}>
            <DynamicIcon name="Circle" className={cn("h-5 w-5 text-destructive mb-1", isMobile && "h-4 w-4 mb-0.5")} />
            <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Pendente</p>
            <p className={cn("text-sm font-bold text-destructive", isMobile && "text-xs")}>R$ {totalPending.toFixed(2)}</p>
          </div>
          <div className={cn("flex flex-col items-center justify-center p-1", isMobile && "p-0.5")}>
            <DynamicIcon name="CreditCard" className={cn("h-5 w-5 text-foreground mb-1", isMobile && "h-4 w-4 mb-0.5")} />
            <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>Total Mês</p>
            <p className={cn("text-sm font-bold text-foreground", isMobile && "text-xs")}>R$ {totalCardExpenses.toFixed(2)}</p>
          </div>
        </div>
      )}

      {selectedCardId !== UNSELECTED_VALUE && filteredExpenses.length > 0 && (
        <div className={cn("rounded-xl border overflow-hidden shadow-sm", isMobile ? "max-h-[30vh] overflow-y-auto" : "")}>
          <Table>
            <TableHeader className="sticky top-0 bg-soft-blue z-10">
              <TableRow>
                <TableHead className="py-1 px-2 text-xs">Data</TableHead>
                <TableHead className="py-1 px-2 text-xs">Subcategoria</TableHead>
                <TableHead className="py-1 px-2 text-right text-xs">Valor</TableHead>
                <TableHead className="py-1 px-2 text-center text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.map(installment => {
                const { name: categoryName, icon: categoryIcon } = getCategoryDisplay(installment.despesas?.categoria_id || null);
                return (
                  <TableRow key={installment.id}>
                    <TableCell className="py-1 px-2 text-xs">{format(new Date(installment.vencimento), "dd/MM", { locale: ptBR })}</TableCell>
                    <TableCell className="py-1 px-2 text-xs flex items-center gap-1">
                      {categoryIcon && <DynamicIcon name={categoryIcon} className="h-3 w-3" />}
                      <span>{categoryName}</span>
                    </TableCell>
                    <TableCell className={cn("py-1 px-2 text-right font-semibold text-xs", installment.pago ? "text-success" : "text-destructive")}>
                      R$ {installment.valor_parcela.toFixed(2)}
                    </TableCell>
                    <TableCell className="py-1 px-2 text-center text-xs">
                      {installment.pago ? (
                        <DynamicIcon name="CheckCircle" className="h-4 w-4 text-success mx-auto" />
                      ) : (
                        <DynamicIcon name="Circle" className="h-4 w-4 text-destructive mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {selectedCardId !== UNSELECTED_VALUE && filteredExpenses.length === 0 && (
        <p className="text-muted-foreground text-center py-4 text-sm">Nenhuma despesa encontrada para este cartão no mês selecionado.</p>
      )}
    </Card>
  );
};