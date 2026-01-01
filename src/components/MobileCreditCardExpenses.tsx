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

  if (!isMobile) return null;

  return (
    <Card
      className={cn("p-3 animate-fade-in rounded-3xl card-3d")}
      style={{ backgroundColor: "#F7F2FF" }}
    >
      <h2 className="text-xs font-semibold text-muted-foreground">
        Cartões de Crédito
      </h2>

      <div className="space-y-2">
        <Select value={selectedCardId} onValueChange={setSelectedCardId}>
          <SelectTrigger className="rounded-xl w-full h-9 text-sm">
            <SelectValue placeholder="Selecione um cartão" />
          </SelectTrigger>
          <SelectContent>
            {cartoes.map((card) => (
              <SelectItem key={card.id} value={card.id} className="text-sm">
                {card.nome} (****{card.ultimos_digitos})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          className="btn-3d rounded-xl w-full h-9 text-sm"
          style={
            {
              "--cor-topo": "#B27CFF",
              "--cor-base": "#7B4ED6",
            } as React.CSSProperties
          }
          onClick={handlePayMonthlyBill}
          disabled={!selectedCardId || selectedCardId === UNSELECTED_VALUE}
        >
          <DynamicIcon name="CreditCard" className="h-3.5 w-3.5" />
          <span className="ml-2">Ver Fatura</span>
        </Button>

        {/* 📌 Indicadores */}
        {selectedCardId !== UNSELECTED_VALUE && (
          <div className="grid grid-cols-3 gap-1 text-center mt-1">
            {/* Pago */}
            <div className="flex flex-col items-center justify-center p-0.5">
              <div
                className="flex items-center justify-center rounded-full bg-[#44E37F] text-white font-black"
                style={{ height: 17, width: 17, fontSize: 9 }}
              >
                ✓
              </div>
              <p className="text-[0.7rem] text-muted-foreground">Pago</p>
              <p className="text-xs font-bold text-success">
                {formatCurrency(totalPaid)}
              </p>
            </div>

            {/* Pendente */}
            <div className="flex flex-col items-center justify-center p-0.5">
              <DynamicIcon
                name="Circle"
                className="h-4 w-4 text-destructive mb-0.5"
              />
              <p className="text-[0.7rem] text-muted-foreground">Pendente</p>
              <p className="text-xs font-bold text-destructive">
                {formatCurrency(totalPending)}
              </p>
            </div>

            {/* Total Mês */}
            <div className="flex flex-col items-center justify-center p-0.5">
              <DynamicIcon
                name="CreditCard"
                className="h-4 w-4 text-foreground mb-0.5"
              />
              <p className="text-[0.7rem] text-muted-foreground">Total Mês</p>
              <p className="text-xs font-bold text-foreground">
                {formatCurrency(totalCardExpenses)}
              </p>
            </div>
          </div>
        )}

        {selectedCardId !== UNSELECTED_VALUE &&
          filteredExpenses.length === 0 && (
            <p className="text-muted-foreground text-center py-2 text-sm">
              Nenhuma despesa no mês selecionado.
            </p>
          )}
      </div>
    </Card>
  );
};
