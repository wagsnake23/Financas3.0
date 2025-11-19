import React, { useState, useMemo, useEffect } from "react"; // Importar useEffect
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory } from "@/types/finance";
import { format, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button"; // Importar Button
import { useMutation, useQueryClient } from "@tanstack/react-query"; // Importar useMutation e useQueryClient
import { supabase } from "@/integrations/supabase/client"; // Importar supabase
import { toast } from "sonner"; // Importar toast
import { useAuth } from "@/hooks/useAuth"; // Importar useAuth

interface MobileCreditCardExpensesProps {
  cartoes: Tables<'cartoes'>[];
  expenseInstallments: (Tables<'despesas_parcelas'> & { despesas: Pick<Tables<'despesas'>, 'id' | 'categoria_id' | 'user_id' | 'descricao' | 'forma_pagamento' | 'tipo_pagão' | 'cartao_id' | 'is_fixed' | 'recurrence_frequency' | 'recurrence_installments_count'> | null })[];
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
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

  // Mutation para marcar parcelas como pagas
  const payMonthlyBillMutation = useMutation({
    mutationFn: async ({ cardId, monthStart, monthEnd }: { cardId: string; monthStart: Date; monthEnd: Date }) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");

      const { data: installmentsToUpdate, error: fetchError } = await supabase
        .from("despesas_parcelas")
        .select("id")
        .eq("pago", false)
        .gte("vencimento", format(monthStart, "yyyy-MM-dd"))
        .lte("vencimento", format(monthEnd, "yyyy-MM-dd"))
        .in("despesa_id", supabase
          .from("despesas")
          .select("id")
          .eq("user_id", user.id)
          .eq("cartao_id", cardId)
          .eq("forma_pagamento", "cartao")
          .filter("is_fixed", "eq", false) // Excluir despesas fixas legadas
        );

      if (fetchError) throw fetchError;

      if (installmentsToUpdate.length === 0) {
        toast.info("Nenhuma despesa pendente encontrada para este cartão no mês.");
        return;
      }

      const installmentIds = installmentsToUpdate.map(i => i.id);

      const { error: updateError } = await supabase
        .from("despesas_parcelas")
        .update({
          pago: true,
          data_pagamento: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        })
        .in("id", installmentIds);

      if (updateError) throw updateError;
      return installmentsToUpdate.length;
    },
    onSuccess: (updatedCount) => {
      queryClient.invalidateQueries({ queryKey: ["expenseInstallments", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] }); // Invalida também a lista de transações
      toast.success(`${updatedCount} despesa(s) do cartão marcada(s) como paga(s)!`, {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
    },
    onError: (error) => {
      toast.error("Erro ao pagar fatura mensal", { description: error.message });
      console.error("Supabase error paying monthly bill:", error);
    },
  });

  const handlePayMonthlyBill = () => {
    if (!selectedCardId || selectedCardId === UNSELECTED_VALUE) {
      toast.error("Selecione um cartão para pagar a fatura.");
      return;
    }
    if (totalPending === 0) {
      toast.info("Não há despesas pendentes para este cartão no mês selecionado.");
      return;
    }

    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    payMonthlyBillMutation.mutate({ cardId: selectedCardId, monthStart, monthEnd });
  };

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
      <h2 className={cn("text-lg font-bold mb-2", isMobile && "text-sm mb-1")}>Cartões de Crédito</h2>

      {cartoes.length === 0 ? (
        <p className="text-muted-foreground text-center py-2 text-sm">Nenhum cartão de crédito cadastrado.</p>
      ) : (
        <div className="flex flex-col gap-2"> {/* Alterado para flex-col gap-2 */}
          <Select value={selectedCardId} onValueChange={setSelectedCardId} className={cn("rounded-xl w-full", isMobile && "h-9 text-sm")}>
            <SelectTrigger className={cn("rounded-xl w-full", isMobile && "h-9 text-sm")}> {/* Adicionada a tag SelectTrigger */}
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
          <Button
            variant="success"
            size="default" // Usar size="default" para que o w-full funcione bem
            onClick={handlePayMonthlyBill}
            disabled={!selectedCardId || selectedCardId === UNSELECTED_VALUE || payMonthlyBillMutation.isPending || totalPending === 0}
            className={cn("rounded-xl w-full", isMobile ? "h-9 text-sm" : "w-auto px-4 h-9 text-xs")} // Ajustado para w-full em mobile
          >
            {payMonthlyBillMutation.isPending ? (
              "..."
            ) : (
              <>
                <DynamicIcon name="CheckCircle" className={cn("h-4 w-4", isMobile && "h-3.5 w-3.5")} />
                <span className="ml-2">Pagar Fatura</span>
              </>
            )}
          </Button>
        </div>
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