import React, { useState, useMemo, useEffect } from "react"; // Importar useEffect
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  // Efeito para definir o primeiro cartão como selecionado quando os cartões são carregados
  useEffect(() => {
    if (cartoes.length > 0 && selectedCardId === UNSELECTED_VALUE) {
      setSelectedCardId(cartoes[0].id);
    } else if (cartoes.length === 0 && selectedCardId !== UNSELECTED_VALUE) {
      // Se todos os cartões forem removidos, resetar a seleção
      setSelectedCardId(UNSELECTED_VALUE);
    }
  }, [cartoes, selectedCardId]);

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

  // A função getCategoryDisplay não é mais necessária se a tabela for removida, mas a manterei caso seja útil para depuração ou futuras expansões.
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
    <Card className={cn("p-4 animate-fade-in space-y-2 bg-soft-purple/20 border border-soft-purple rounded-xl shadow-sm", isMobile && "p-3 space-y-2")}>
      <h2 className={cn("text-lg font-bold mb-2", isMobile && "text-sm mb-1")}>Cartão de Créditos</h2>

      {cartoes.length === 0 ? (
        <p className="text-muted-foreground text-center py-2 text-sm">Nenhum cartão de crédito cadastrado.</p>
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
        <div className={cn("grid grid-cols-3 gap-2 text-center mt-2", isMobile && "gap-1 mt-1")}>
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
      {selectedCardId !== UNSELECTED_VALUE && filteredExpenses.length === 0 && (
        <p className="text-muted-foreground text-center py-2 text-sm">Nenhuma despesa encontrada para este cartão no mês selecionado.</p>
      )}
    </Card>
  );
};