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
      className={cn("pl-[20px] pr-[20px] pt-[10px] pb-[10px] relative overflow-hidden card-cartoes h-full w-full flex flex-col justify-center")}
      style={{
        borderRadius: "18px",
        background: "linear-gradient(135deg, #f6f5f9 0%, #efedf4 60%, rgba(124, 58, 237, 0.10) 100%)",
        backgroundBlendMode: "soft-light",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(0,0,0,0.06)",
        outline: "1px solid rgba(124, 58, 237, 0.08)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.03), inset 0 0 18px rgba(124, 58, 237, 0.12)"
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <DynamicIcon name="CreditCard" className="h-6 w-6" style={{ color: "#6d28d9" }} />
          <h2 className="text-[15px] font-extrabold leading-none tracking-tight md:text-[17px]" style={{ color: "#6d28d9", fontFamily: "'Inter', sans-serif" }}>
            Cartões
          </h2>
        </div>
        <span className="text-[12px] font-bold text-[#111827] uppercase tracking-tight" style={{ letterSpacing: "0.5px" }}>
          {format(selectedMonth, "MMM / yyyy", { locale: ptBR }).replace(".", "")}
        </span>
      </div>

      <div className="space-y-1">
        <Select value={selectedCardId} onValueChange={setSelectedCardId}>
          <SelectTrigger className="rounded-xl w-full h-[30px] text-[13px] border shadow-sm font-medium" style={{ background: "#f8fafc", borderColor: "#d8b4fe", color: "#1e293b" }}>
            <SelectValue placeholder="Selecione um cartão" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {cartoes.map((card) => (
              <SelectItem key={card.id} value={card.id} className="text-sm">
                {card.nome} {card.ultimos_digitos}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          className="rounded-[14px] w-full h-[32px] text-[13px] font-bold text-[#ffffff] border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)]"
          style={{ background: "linear-gradient(135deg, #6d28d9, #7c3aed)", borderBottom: "1px solid rgba(0,0,0,0.4)", filter: "saturate(0.95)", boxShadow: "0 6px 14px rgba(0,0,0,0.12)" }}
          onClick={handlePayMonthlyBill}
          disabled={!selectedCardId || selectedCardId === UNSELECTED_VALUE}
        >
          <DynamicIcon name="Eye" className="h-3.5 w-3.5 mr-2" />
          <span>Ver Fatura</span>
        </Button>

        {/* 📌 Indicadores */}
        {selectedCardId !== UNSELECTED_VALUE && (
          <div className="grid grid-cols-3 gap-2 text-center mt-2 pt-0.5 md:mt-6">
            {/* Pago */}
            <div className={cn("flex flex-col items-center transition-opacity duration-300", totalPending > 0 && "opacity-40 grayscale")}>
              <div className="flex items-center gap-1.5 mb-1">
                <div
                  className="flex items-center justify-center rounded-full bg-[#22c55e] text-white font-black"
                  style={{ height: 14, width: 14, fontSize: 7, boxShadow: "0 0 8px rgba(34,197,94,0.4)" }}
                >
                  ✓
                </div>
                <p className="text-[0.65rem] text-[#22c55e] font-bold md:text-sm">Pago</p>
              </div>
              <p className="text-[13px] md:text-[16px] leading-none" style={{ color: "#1f2937", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', fontWeight: 800, WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.1), 0 0 4px rgba(255,255,255,0.4)" }}>
                <FormatCurrencyStyled value={totalPaid} prefixColor="#22c55e" />
              </p>
            </div>

            {/* Pendente */}
            <div className={cn("flex flex-col items-center transition-opacity duration-300", totalPending <= 0 && "opacity-40 grayscale")}>
              <div className="flex items-center gap-1.5 mb-1">
                <DynamicIcon
                  name="Circle"
                  className="h-3.5 w-3.5 text-[#ef4444]"
                  style={{ filter: "drop-shadow(0 0 4px rgba(239,68,68,0.4))" }}
                />
                <p className="text-[0.65rem] text-[#ef4444] font-bold md:text-sm">Pendente</p>
              </div>
              <p className="text-[13px] md:text-[16px] leading-none" style={{ color: "#1f2937", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', fontWeight: 800, WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.1), 0 0 4px rgba(255,255,255,0.4)" }}>
                <FormatCurrencyStyled value={totalPending} prefixColor="#ef4444" />
              </p>
            </div>

            {/* Total Mês */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 mb-1">
                <DynamicIcon
                  name="CreditCard"
                  className="h-3.5 w-3.5 text-[#6b7280]"
                />
                <p className="text-[0.65rem] text-[#6b7280] font-medium md:text-sm">Total</p>
              </div>
              <p className="text-[13px] md:text-[16px] leading-none" style={{ color: "#4b5563", fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', fontWeight: 600, WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textShadow: "none" }}>
                <FormatCurrencyStyled value={totalCardExpenses} prefixColor="#6b7280" />
              </p>
            </div>
          </div>
        )}

        {selectedCardId !== UNSELECTED_VALUE &&
          filteredExpenses.length === 0 && (
            <p className="text-[#6b7280] text-center py-1 text-xs">
              Nenhuma despesa no mês selecionado.
            </p>
          )}
      </div>
    </Card>
  );
};

const FormatCurrencyStyled = ({ value, prefixColor }: { value: number, prefixColor?: string }) => {
  const formatted = formatCurrency(value);
  const match = formatted.match(/^(R\$)\s?(.*)$/);
  if (match) {
    return (
      <>
        <span style={{ color: prefixColor, opacity: prefixColor ? 1 : 0.85, fontSize: "0.85em", fontWeight: 500, marginRight: "4px", verticalAlign: "baseline" }}>{match[1]}</span>
        {match[2]}
      </>
    );
  }
  return <>{formatted}</>;
};
