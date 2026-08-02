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
import { format, startOfMonth, addMonths, subMonths } from "date-fns";
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

  const monthlyCardBalances = useMemo(() => {
    if (selectedCardId === UNSELECTED_VALUE) return [];
    
    const today = new Date();
    const diffMonths = (today.getFullYear() - selectedMonth.getFullYear()) * 12 + (today.getMonth() - selectedMonth.getMonth());
    const endMonth = (diffMonths >= 0 && diffMonths < 10) ? today : selectedMonth;
    
    const list = [];
    for (let i = 9; i >= 0; i--) {
      const m = subMonths(endMonth, i);
      const mStr = format(m, "yyyy-MM");
      
      const billValue = expenseInstallments
        .filter(
          (p) =>
            p.despesas?.forma_pagamento === "cartao" &&
            p.despesas.cartao_id === selectedCardId &&
            p.vencimento.startsWith(mStr)
        )
        .reduce((sum, p) => sum + p.valor_parcela, 0);
        
      list.push({
        monthStr: mStr,
        balance: billValue,
        date: m
      });
    }
    return list;
  }, [expenseInstallments, selectedCardId, selectedMonth]);

  const sparklinePoints = useMemo(() => {
    if (monthlyCardBalances.length === 0) return [];
    const balances = monthlyCardBalances.map(m => m.balance);
    const minBal = Math.min(...balances);
    const maxBal = Math.max(...balances);
    const range = maxBal - minBal === 0 ? 1 : maxBal - minBal;
    
    return monthlyCardBalances.map((item, i) => {
      const y = 40 - ((item.balance - minBal) / range) * 35;
      // Start at X=10, end at X=138 (leaving 22px margin on the right)
      return {
        x: 10 + i * (128 / 9),
        y,
        monthStr: item.monthStr,
        balance: item.balance
      };
    });
  }, [monthlyCardBalances]);

  const linePath = useMemo(() => {
    if (sparklinePoints.length === 0) return "";
    let path = `M ${sparklinePoints[0].x} ${sparklinePoints[0].y}`;
    for (let i = 0; i < sparklinePoints.length - 1; i++) {
      const p0 = sparklinePoints[i];
      const p1 = sparklinePoints[i + 1];
      const dx = (p1.x - p0.x) / 2.5;
      const cpX1 = p0.x + dx;
      const cpY1 = p0.y;
      const cpX2 = p1.x - dx;
      const cpY2 = p1.y;
      path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return path;
  }, [sparklinePoints]);

  const fillPath = useMemo(() => {
    if (linePath === "") return "";
    return `${linePath} L 138 44 L 10 44 Z`;
  }, [linePath]);

  const selectedMonthIdx = useMemo(() => {
    const selStr = format(selectedMonth, "yyyy-MM");
    return monthlyCardBalances.findIndex(item => item.monthStr === selStr);
  }, [monthlyCardBalances, selectedMonth]);

  return (
    <Card
      className={cn("pl-3 pr-[16px] pt-[8px] pb-[12px] rounded-[16px] relative overflow-hidden card-cartoes h-full w-full flex flex-col justify-center")}
      style={{
        borderRadius: "16px",
        background: "linear-gradient(180deg, #FFFFFF 0%, #FCFDFF 100%)",
        backdropFilter: "blur(18px) saturate(1.4)",
        WebkitBackdropFilter: "blur(18px) saturate(1.4)",
        border: "1px solid rgba(255,255,255,0.80)",
        backgroundClip: "padding-box",
        outline: "none",
        boxShadow: "0 8px 32px rgba(15,23,42,0.12), 0 1px 0 rgba(255,255,255,0.8) inset"
      }}
    >

      <div className="flex flex-col mt-[2px] w-full">
        {/* Top Header Row */}
        <div className="flex justify-between items-center w-full mb-1.5 gap-2">
          {/* Left side: Selector (iOS Style: no border, no bg, no shadow, occupies remaining space) */}
          <div className="flex-1 min-w-0">
            <Select value={selectedCardId} onValueChange={setSelectedCardId}>
              <SelectTrigger 
                className="w-full h-[33px] text-[13.5px] border-none font-bold tracking-tight p-0 shadow-none focus:ring-0 [&>svg]:hidden" 
                style={{ 
                  background: "none", 
                  border: "none", 
                  color: "#1e293b",
                  boxShadow: "none",
                  outline: "none"
                }}
              >
                <div className="flex items-center gap-1 min-w-0 truncate">
                  <SelectValue placeholder="Cartão" />
                  <span className="text-[#1F2937] font-bold text-[14px] ml-0.5 leading-none select-none">▼</span>
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {cartoes.map((card) => (
                  <SelectItem key={card.id} value={card.id} className="text-sm">
                    {card.nome} {card.ultimos_digitos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Right side: Purple Button (Exact 135px width) */}
          <div className="shrink-0">
            <Button
              className="w-[135px] h-9 px-3 rounded-[11px] font-bold text-[12px] text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_3px_8px_rgba(0,0,0,0.4)] flex items-center justify-center gap-1.5 whitespace-nowrap"
              style={{ 
                background: "linear-gradient(135deg, #6d28d9, #5b21b6)", 
                borderBottom: "1px solid rgba(0,0,0,0.4)", 
                filter: "saturate(0.95)", 
                boxShadow: "0 6px 14px rgba(109,40,217,0.15)" 
              }}
              onClick={handlePayMonthlyBill}
              disabled={!selectedCardId || selectedCardId === UNSELECTED_VALUE}
            >
              <DynamicIcon name="Eye" className="h-3.5 w-3.5" />
              <span>Ver Fatura</span>
            </Button>
          </div>
        </div>

        {/* 📌 Indicadores */}
        {selectedCardId !== UNSELECTED_VALUE && (
          <div className="flex justify-between items-end w-full mt-0.5 relative z-20">
            {/* Lado esquerdo: Gráfico de tendência roxo */}
            <div className="flex-1 min-w-0 flex flex-col items-start justify-end -ml-1 -mt-[12px]">
              <svg viewBox="0 0 160 45" className="w-full max-w-[170px] h-[64px] overflow-visible">
                <defs>
                  <linearGradient id="card-sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
                    <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.00" />
                  </linearGradient>
                  <filter id="card-point-shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="1" stdDeviation="0.6" floodColor="#000" floodOpacity="0.15" />
                  </filter>
                  <filter id="red-glow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="blur" />
                    <feOffset dx="0" dy="1" />
                    <feComponentTransfer in="blur" result="glow">
                      <feFuncA type="linear" slope="0.3" />
                    </feComponentTransfer>
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <path
                  d={fillPath}
                  fill="url(#card-sparkline-grad)"
                  style={{ transition: 'all 220ms ease-in-out' }}
                />
                <path
                  d={linePath}
                  fill="none"
                  stroke="#6D28D9"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{ transition: 'all 220ms ease-in-out' }}
                />
                {sparklinePoints.map((pt, idx) => {
                  const isSelected = idx === selectedMonthIdx;
                  return (
                    <circle
                      key={idx}
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 4.2 : 3}
                      fill={isSelected ? "#EF6C6C" : "#6D28D9"}
                      stroke="#fff"
                      strokeWidth={isSelected ? 1.6 : 1.2}
                      filter={isSelected ? "url(#red-glow)" : "url(#card-point-shadow)"}
                      style={{ transition: 'all 220ms ease-in-out' }}
                    />
                  );
                })}
              </svg>
              <span className="text-[10px] font-semibold text-[#6b7280] mt-[8px] tracking-tight pl-[10px] leading-none">
                Últimos 10 meses
              </span>
            </div>

            {/* Lado direito: Título e Valor principal (Exact 135px width to align with button) */}
            <div className="w-[135px] shrink-0 flex flex-col justify-end items-end text-right pb-[1px] pt-3">
              <div className="mb-2">
                <h2 className="text-[13.8px] font-extrabold leading-none tracking-tight mb-2" style={{ color: totalPending > 0 ? "#D97706" : "#16A34A", fontFamily: "'Inter', sans-serif" }}>
                  {totalPending > 0 ? "Fatura Pendente" : "Fatura Paga"}
                </h2>
              </div>
              <p className="text-[21px] font-[800] leading-none" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: "#1f2937", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", letterSpacing: "-0.015em", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textShadow: "0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.1), 0 0 4px rgba(255,255,255,0.4)" }}>
                <FormatCurrencyStyled value={totalPending > 0 ? totalPending : totalPaid} prefixColor="#1f2937" />
              </p>
            </div>
          </div>
        )}

        {selectedCardId !== UNSELECTED_VALUE &&
          filteredExpenses.length === 0 && (
            <p className="text-[#6b7280] text-center py-1 text-xs mt-2.5">
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
