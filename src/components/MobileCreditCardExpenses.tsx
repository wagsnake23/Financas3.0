import React, { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DynamicIcon from "./DynamicIcon";
import { cn, formatCurrency } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { format, startOfMonth, addMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AppCategory } from "@/types/finance";
import { ptBR } from "date-fns/locale";

interface MobileCreditCardExpensesProps {
  cartoes: Tables<"cartoes">[];
  expenseInstallments: (Tables<"despesas_parcelas"> & {
    despesas: Pick<
      Tables<"despesas">,
      | "id"
      | "categoria_id"
      | "user_id"
      | "descricao"
      | "forma_pagamento"
      | "tipo_pagamento"
      | "cartao_id"
    > | null;
  })[];
  allCategories: AppCategory[];
  isMobile: boolean;
  selectedMonth: Date;
}

const UNSELECTED_VALUE = "unselected";

export const MobileCreditCardExpenses: React.FC<
  MobileCreditCardExpensesProps
> = ({ cartoes, expenseInstallments, isMobile, selectedMonth }) => {
  const navigate = useNavigate();
  const [selectedCardId, setSelectedCardId] =
    useState<string>(UNSELECTED_VALUE);

  useEffect(() => {
    if (cartoes.length > 0 && selectedCardId === UNSELECTED_VALUE) {
      setSelectedCardId(cartoes[0].id);
    } else if (cartoes.length === 0 && selectedCardId !== UNSELECTED_VALUE) {
      setSelectedCardId(UNSELECTED_VALUE);
    }
  }, [cartoes, selectedCardId]);

  const filteredExpenses = useMemo(() => {
    if (selectedCardId === UNSELECTED_VALUE) return [];

    const monthStart = startOfMonth(selectedMonth);
    const startStr = format(monthStart, "yyyy-MM-01");
    const nextMonthStartStr = format(addMonths(monthStart, 1), "yyyy-MM-01");

    return expenseInstallments
      .filter(
        (p) =>
          p.despesas?.forma_pagamento === "cartao" &&
          p.despesas.cartao_id === selectedCardId
      )
      .filter((p) => {
        const vencimentoDate = p.vencimento.substring(0, 10);
        return vencimentoDate >= startStr && vencimentoDate < nextMonthStartStr;
      })
      .sort(
        (a, b) =>
          new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime()
      );
  }, [expenseInstallments, selectedCardId, selectedMonth]);

  const { totalPaid, totalPending, totalCardExpenses } = useMemo(() => {
    let paid = 0;
    let pending = 0;
    filteredExpenses.forEach((installment) => {
      if (installment.pago) {
        paid += installment.valor_parcela;
      } else {
        pending += installment.valor_parcela;
      }
    });
    return {
      totalPaid: paid,
      totalPending: pending,
      totalCardExpenses: paid + pending,
    };
  }, [filteredExpenses]);

  const handlePayMonthlyBill = () => {
    if (!selectedCardId || selectedCardId === UNSELECTED_VALUE) return;
    const formattedMonth = format(selectedMonth, "yyyy-MM-dd");
    navigate(`/lancamentos?cardId=${selectedCardId}&month=${formattedMonth}`);
  };


  return (
    <Card
      className={cn("px-5 pt-3 pb-4 animate-fade-in rounded-[24px] border border-[#F0E8FF] shadow-[0_4px_12px_rgba(0,0,0,0.03)] relative overflow-hidden bg-white mb-4")}
      style={{ background: "linear-gradient(180deg, #E2D3FF 0%, #FFFFFF 100%)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <DynamicIcon name="CreditCard" className="h-6 w-6 text-[#5429A6]" />
          <h2 className="text-[15px] font-black text-[#5429A6] tracking-tight">
            Cartões
          </h2>
        </div>
        <span className="text-[12px] font-black text-[#5429A6] uppercase tracking-tight">
          {format(selectedMonth, "MMM / yyyy", { locale: ptBR }).replace(".", "")}
        </span>
      </div>

      <div className="space-y-1.5">
        <Select value={selectedCardId} onValueChange={setSelectedCardId}>
          <SelectTrigger className="rounded-xl w-full h-8 text-[13px] border-[#B299FF] bg-white shadow-sm">
            <SelectValue placeholder="Selecione um cartão" />
          </SelectTrigger>
          <SelectContent>
            {cartoes.map((card) => (
              <SelectItem key={card.id} value={card.id} className="text-sm">
                {card.nome} {card.ultimos_digitos}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          className="btn-3d rounded-xl w-full h-[32px] text-xs font-bold shadow-md"
          style={
            {
              "--cor-topo": "#9d50ff",
              "--cor-base": "#8235ff",
            } as React.CSSProperties
          }
          onClick={handlePayMonthlyBill}
          disabled={!selectedCardId || selectedCardId === UNSELECTED_VALUE}
        >
          <DynamicIcon name="Eye" className="h-3.5 w-3.5 mr-2" />
          <span>Ver Fatura</span>
        </Button>

        {/* 📌 Indicadores */}
        {selectedCardId !== UNSELECTED_VALUE && (
          <div className="grid grid-cols-3 gap-2 text-center mt-1 border-t border-[#DCD2FF]/30 pt-2.5">
            {/* Pago */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 mb-1">
                <div
                  className="flex items-center justify-center rounded-full bg-[#44E37F]/90 text-white font-black"
                  style={{ height: 14, width: 14, fontSize: 7 }}
                >
                  ✓
                </div>
                <p className="text-[0.65rem] text-gray-500 font-bold">Pago</p>
              </div>
              <p className="text-[11px] font-bold text-success/80">
                {formatCurrency(totalPaid)}
              </p>
            </div>

            {/* Pendente */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 mb-1">
                <DynamicIcon
                  name="Circle"
                  className="h-3.5 w-3.5 text-destructive/70"
                />
                <p className="text-[0.65rem] text-gray-500 font-bold">Pendente</p>
              </div>
              <p className="text-[11px] font-bold text-destructive/80">
                {formatCurrency(totalPending)}
              </p>
            </div>

            {/* Total Mês */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 mb-1">
                <DynamicIcon
                  name="CreditCard"
                  className="h-3.5 w-3.5 text-gray-500"
                />
                <p className="text-[0.65rem] text-gray-500 font-bold">Total</p>
              </div>
              <p className="text-[11px] font-bold text-gray-700">
                {formatCurrency(totalCardExpenses)}
              </p>
            </div>
          </div>
        )}

        {selectedCardId !== UNSELECTED_VALUE &&
          filteredExpenses.length === 0 && (
            <p className="text-muted-foreground text-center py-1 text-xs">
              Nenhuma despesa no mês selecionado.
            </p>
          )}
      </div>
    </Card>
  );
};
