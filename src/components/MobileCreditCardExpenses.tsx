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
import { AddCardDialog } from "@/components/AddCardDialog";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";

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
  isLoading?: boolean;
}

const UNSELECTED_VALUE = "unselected";

export const MobileCreditCardExpenses: React.FC<
  MobileCreditCardExpensesProps
> = React.memo(({ cartoes, expenseInstallments, isMobile, selectedMonth, isLoading, allCategories }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();


  // 1. Initial/Default selection calculated synchronously
  const defaultCardId = useMemo(() => {
    if (!cartoes || cartoes.length === 0) return UNSELECTED_VALUE;
    const principalCard = cartoes.find((c) => (c as any).is_principal);
    return principalCard ? principalCard.id : cartoes[0].id;
  }, [cartoes]);

  // 2. User-controlled selection state
  const [userSelectedCardId, setUserSelectedCardId] = useState<string | null>(null);

  // 3. Current active selectedCardId (instant, no useEffect delay or re-renders)
  const selectedCardId = useMemo(() => {
    if (userSelectedCardId && cartoes?.some((c) => c.id === userSelectedCardId)) {
      return userSelectedCardId;
    }
    return defaultCardId;
  }, [userSelectedCardId, defaultCardId, cartoes]);

  // AUDITORIA TEMPORÁRIA
  if (process.env.NODE_ENV === 'development') {
    console.count("MobileCreditCardExpenses render");
    console.log({
      selectedCardId,
      userSelectedCardId,
      cartoes: cartoes?.length || 0,
      parcelas: expenseInstallments?.length || 0,
      isLoading
    });
  }

  // 4. Performance: Pre-filter installments ONCE for the active card
  const cardInstallments = useMemo(() => {
    if (!selectedCardId || selectedCardId === UNSELECTED_VALUE || !expenseInstallments) return [];
    return expenseInstallments.filter(
      (p) =>
        p.despesas?.forma_pagamento === "cartao" &&
        p.despesas.cartao_id === selectedCardId
    );
  }, [expenseInstallments, selectedCardId]);

  // 5. Filter for currently selected month
  const filteredExpenses = useMemo(() => {
    if (cardInstallments.length === 0) return [];

    const monthStart = startOfMonth(selectedMonth);
    const startStr = format(monthStart, "yyyy-MM-01");
    const nextMonthStartStr = format(addMonths(monthStart, 1), "yyyy-MM-01");

    return cardInstallments
      .filter((p) => {
        const vencimentoDate = p.vencimento.substring(0, 10);
        return vencimentoDate >= startStr && vencimentoDate < nextMonthStartStr;
      })
      .sort(
        (a, b) =>
          new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime()
      );
  }, [cardInstallments, selectedMonth]);

  // 6. Totals for current month bill
  const { totalPaid, totalPending, totalCardExpenses } = useMemo(() => {
    let paid = 0;
    let pending = 0;
    for (let i = 0; i < filteredExpenses.length; i++) {
      const installment = filteredExpenses[i];
      if (installment.pago) {
        paid += installment.valor_parcela;
      } else {
        pending += installment.valor_parcela;
      }
    }
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

  // 7. Monthly balances for the 10-month sparkline (Single-pass accumulation)
  const monthlyCardBalances = useMemo(() => {
    if (selectedCardId === UNSELECTED_VALUE) return [];
    
    const today = new Date();
    const diffMonths = (today.getFullYear() - selectedMonth.getFullYear()) * 12 + (today.getMonth() - selectedMonth.getMonth());
    const endMonth = (diffMonths >= 0 && diffMonths < 10) ? today : selectedMonth;
    
    const list: { monthStr: string; balance: number; date: Date }[] = [];
    const monthTotals: Record<string, number> = {};

    for (let i = 9; i >= 0; i--) {
      const m = subMonths(endMonth, i);
      const mStr = format(m, "yyyy-MM");
      monthTotals[mStr] = 0;
      list.push({
        monthStr: mStr,
        balance: 0,
        date: m
      });
    }

    // Single-pass over cardInstallments to compute all 10 months simultaneously
    for (let i = 0; i < cardInstallments.length; i++) {
      const p = cardInstallments[i];
      const mStr = p.vencimento.substring(0, 7);
      if (monthTotals[mStr] !== undefined) {
        monthTotals[mStr] += p.valor_parcela;
      }
    }

    for (let i = 0; i < list.length; i++) {
      list[i].balance = monthTotals[list[i].monthStr] || 0;
    }

    return list;
  }, [cardInstallments, selectedCardId, selectedMonth]);

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

  const mainColor = "#6D28D9";
  const gradColor = "#8B5CF6";

  // GUARD: If explicitly loading or cartoes is not available yet, render SKELETON
  if (isLoading || !cartoes) {
    return (
      <Card
        className={cn("home-mobile-card rounded-[22px] relative overflow-hidden card-cartoes h-full w-full flex flex-col justify-center md:p-6 md:flex md:flex-col md:justify-between")}
        style={{
          borderRadius: "22px",
          background: "radial-gradient(circle at top right, rgba(255,255,255,.70), transparent 60%), linear-gradient(135deg, rgba(124,58,237,.20) 0%, rgba(124,58,237,.12) 35%, rgba(124,58,237,.06) 70%, rgba(124,58,237,.11) 85%, rgba(124,58,237,.15) 100%), #F7F2FF",
          border: "1px solid rgba(255,255,255,0.85)",
          backgroundClip: "padding-box",
          outline: "none",
          boxShadow: "0 8px 24px rgba(124,58,237,0.10), 0 2px 6px rgba(124,58,237,0.05), inset 0 1px 0 rgba(255,255,255,.95)"
        }}
      >
        <div className="flex flex-col w-full h-full justify-between pointer-events-none relative z-20" style={{ paddingTop: "0px" }}>
          {/* Top Header Row skeleton */}
          <div className="flex justify-between items-start w-full mb-[8px]">
            <div className="w-full" style={{ position: 'relative', top: isMobile ? '2px' : '0' }}>
              <div className="w-full h-[32px] rounded-[9px] bg-slate-200/60 animate-pulse border border-[#e2e8f0]" />
            </div>
          </div>

          {/* Bottom Indicators skeleton */}
          <div className="flex justify-between items-end w-full relative z-20 -translate-y-[2px] animate-pulse">
            <div className="w-[120px] h-[var(--home-chart-h,64px)] bg-slate-200/40 rounded-lg -ml-1" />
            <div className="w-[135px] md:w-[150px] shrink-0 flex flex-col justify-end items-end gap-1 text-right">
              <div className="h-[12px] w-20 bg-slate-200/60 rounded mb-[2px]" />
              <div className="h-[14px] w-24 bg-slate-200/60 rounded mb-[2px]" />
              <div className="h-[20px] w-28 bg-slate-200/60 rounded" />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (cartoes.length === 0) {
    return (
      <Card
        className={cn("home-mobile-card md:pt-[8px] md:pb-[7px] md:px-8 rounded-[22px] relative overflow-hidden card-cartoes h-full w-full flex flex-col justify-center items-center")}
        style={{
          borderRadius: "22px",
          background: "radial-gradient(circle at top right, rgba(255,255,255,.70), transparent 60%), linear-gradient(135deg, rgba(124,58,237,.20) 0%, rgba(124,58,237,.12) 35%, rgba(124,58,237,.06) 70%, rgba(124,58,237,.11) 85%, rgba(124,58,237,.15) 100%), #F7F2FF",
          border: "1px solid rgba(255,255,255,0.85)",
          backgroundClip: "padding-box",
          outline: "none",
          boxShadow: "0 8px 24px rgba(124,58,237,0.10), 0 2px 6px rgba(124,58,237,0.05), inset 0 1px 0 rgba(255,255,255,.95)"
        }}
      >
        {/* Formas orgânicas temáticas de fundo */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden rounded-[22px]" style={{ zIndex: 0 }}>
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox={isMobile ? "0 0 400 180" : "0 0 500 220"}>
            <defs>
              <linearGradient id={isMobile ? "wave-grad-cartoes-empty-mob" : "wave-grad-cartoes-empty-desk"} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity={isMobile ? "0.15" : "0.12"} />
              </linearGradient>
            </defs>
            {/* Curva suave superior */}
            <path d={isMobile ? "M 60,0 C 150,55 240,65 380,15 L 400,0 Z" : "M 80,0 C 180,60 300,75 480,20 L 500,0 Z"} fill="rgba(255,255,255,0.5)" />
            {/* Onda orgânica inferior */}
            <path d={isMobile ? "M 0,180 Q 120,115 220,135 T 400,85 L 400,180 Z" : "M 0,220 Q 150,135 280,165 T 500,105 L 500,220 Z"} fill={`url(#${isMobile ? "wave-grad-cartoes-empty-mob" : "wave-grad-cartoes-empty-desk"})`} />
          </svg>
        </div>

        <div className="flex flex-col items-center justify-center text-center py-2 px-4 h-full md:py-0 relative z-20">
          <div className="flex items-center gap-1.5 mb-1.5">
             <span className="text-base leading-none">💳</span>
             <h3 className="text-[15px] font-extrabold text-slate-800 tracking-tight leading-none pt-[1px]" style={{ color: "#1e3a8a" }}>Nenhum cartão cadastrado</h3>
          </div>
          <p className="text-[12.5px] font-medium text-slate-500 mb-3 leading-tight">
            Cadastre seu primeiro cartão.
          </p>
          <AddCardDialog 
            user={user} 
            onCardAdded={() => queryClient.invalidateQueries({ queryKey: ["cartoes"] })} 
            customTrigger={
              <Button
                className="h-8 px-4 rounded-[10px] font-bold text-[13px] text-white border-none transition-all hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", borderBottom: "1px solid rgba(0,0,0,0.4)", filter: "saturate(0.95)", boxShadow: "0 4px 10px rgba(0,0,0,0.12)" }}
              >
                Cadastrar cartão
              </Button>
            }
          />
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn("home-mobile-card rounded-[22px] relative overflow-hidden card-cartoes h-full w-full flex flex-col justify-center md:p-6 md:flex md:flex-col md:justify-between cursor-pointer transition-transform active:scale-[0.99]")}
      onClick={handlePayMonthlyBill}
      style={{
        borderRadius: "22px",
        background: "radial-gradient(circle at top right, rgba(255,255,255,.70), transparent 60%), linear-gradient(135deg, rgba(124,58,237,.20) 0%, rgba(124,58,237,.12) 35%, rgba(124,58,237,.06) 70%, rgba(124,58,237,.11) 85%, rgba(124,58,237,.15) 100%), #F7F2FF",
        border: "1px solid rgba(255,255,255,0.85)",
        backgroundClip: "padding-box",
        outline: "none",
        boxShadow: "0 8px 24px rgba(124,58,237,0.10), 0 2px 6px rgba(124,58,237,0.05), inset 0 1px 0 rgba(255,255,255,.95)"
      }}
    >
      {/* Formas orgânicas temáticas de fundo */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden rounded-[22px]" style={{ zIndex: 0 }}>
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox={isMobile ? "0 0 400 180" : "0 0 500 220"}>
          <defs>
            <linearGradient id={isMobile ? "wave-grad-cartoes-mob" : "wave-grad-cartoes-desk"} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity={isMobile ? "0.15" : "0.12"} />
            </linearGradient>
          </defs>
          {/* Curva suave superior */}
          <path d={isMobile ? "M 60,0 C 150,55 240,65 380,15 L 400,0 Z" : "M 80,0 C 180,60 300,75 480,20 L 500,0 Z"} fill="rgba(255,255,255,0.5)" />
          {/* Onda orgânica inferior */}
          <path d={isMobile ? "M 0,180 Q 120,115 220,135 T 400,85 L 400,180 Z" : "M 0,220 Q 150,135 280,165 T 500,105 L 500,220 Z"} fill={`url(#${isMobile ? "wave-grad-cartoes-mob" : "wave-grad-cartoes-desk"})`} />
        </svg>
      </div>

      <div className="flex flex-col w-full h-full justify-between pointer-events-auto relative z-20" style={{ paddingTop: "0px" }}>
        {/* Top Header Row */}
        <div className="flex justify-between items-start w-full mb-[8px]">
          {/* Header Row: Full width selector */}
          <div className="w-full" onClick={(e) => e.stopPropagation()} style={{ position: 'relative', top: isMobile ? '2px' : '0' }}>
            <Select value={selectedCardId} onValueChange={setUserSelectedCardId}>
              <SelectTrigger 
                className="w-full h-[32px] text-[13.5px] font-bold tracking-tight px-3.5 rounded-[9px] hover:border-[#C5D1E8] focus:border-[#AFC0E8] focus:ring-0 [&>svg]:hidden transition-colors flex items-center justify-between" 
                style={{ 
                  background: "#FAFAFA", 
                  color: "#1e293b",
                  border: "1px solid #e2e8f0",
                  borderTop: "1px solid #cbd5e1",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.03), 0 1px 0 rgba(255,255,255,0.8)"
                }}
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <span className="shrink-0 leading-none" style={{ fontSize: "16px" }}>💳</span>
                  <SelectValue placeholder="Cartão" />
                </div>
                <span className="text-[#1F2937] font-bold text-[14px] ml-2 shrink-0 leading-none select-none">▼</span>
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
        </div>

        {/* 📌 Indicadores */}
        {selectedCardId !== UNSELECTED_VALUE && (
          <div className="flex justify-between items-end w-full relative z-20 -translate-y-[2px]">
            {/* Lado esquerdo: Gráfico de tendência roxo */}
            <div className="flex-1 min-w-0 flex flex-col items-start justify-end -ml-1">
              <svg viewBox="0 0 160 45" className={`w-full overflow-visible ${isMobile ? "max-w-[170px] h-[var(--home-chart-h,64px)]" : "max-w-[210px] h-[75px]"}`}>
                <defs>
                  <linearGradient id="card-sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={gradColor} stopOpacity="0.25" />
                    <stop offset="50%" stopColor={gradColor} stopOpacity="0.12" />
                    <stop offset="100%" stopColor={gradColor} stopOpacity="0.00" />
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
                  stroke={mainColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{ transition: 'all 220ms ease-in-out', filter: 'drop-shadow(0 4px 10px rgba(124,58,237,0.18))' }}
                />
                {sparklinePoints.map((pt, idx) => {
                  const isSelected = idx === selectedMonthIdx;
                  return (
                    <circle
                      key={idx}
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 4.2 : (isMobile ? 3 : 3.5)}
                      fill={isSelected ? "#EF6C6C" : mainColor}
                      stroke="#fff"
                      strokeWidth={isSelected ? 1.6 : (isMobile ? 1.2 : 1.5)}
                      filter={isSelected ? "url(#red-glow)" : "url(#card-point-shadow)"}
                      style={{ transition: 'all 220ms ease-in-out' }}
                    />
                  );
                })}
              </svg>
              <span className="text-[10px] font-medium text-[#0F172A] mt-[3px] mb-[1px] md:mb-0 tracking-tight pl-[10px] leading-none">
                Últimos 10 meses
              </span>
            </div>

            {/* Lado direito: Título e Valor principal (Exact width to align with button) */}
            <div className="w-[135px] md:w-[150px] shrink-0 flex flex-col justify-end items-end text-right">
              {/* Período da fatura */}
              <span 
                className="text-[12px] font-extrabold tracking-wide uppercase mb-[2px]" 
                style={{ color: totalPending > 0 ? "#1F2937" : "#6b7280", fontFamily: "'Inter', sans-serif" }}
              >
                {format(selectedMonth, "MMM | yyyy", { locale: ptBR }).replace(".", "")}
              </span>
              <h2 className="text-[15px] tracking-[0.5px] md:text-[17px] mb-1 whitespace-nowrap" style={{ color: totalPending > 0 ? (isMobile ? "#ef4444" : "#b91c1c") : "#15803D", fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>
                {totalPending > 0 ? "Fatura Pendente" : "Fatura Paga"}
              </h2>
              <p className="leading-none transition-all" style={{ marginTop: "-3px", fontSize: isMobile ? "21px" : "26px", fontWeight: 700, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', color: totalPending > 0 ? "#1f2937" : "#6b7280", letterSpacing: "-0.5px", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale", fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"', textRendering: "optimizeLegibility" }}>
                <FormatCurrencyStyled value={totalPending > 0 ? totalPending : totalPaid} prefixColor={totalPending > 0 ? "#EF6C6C" : "#6b7280"} />
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
});

const FormatCurrencyStyled = ({ value, prefixColor }: { value: number, prefixColor?: string }) => {
  const formatted = formatCurrency(value);
  const match = formatted.match(/^(R\$)\s?(.*)$/);
  if (match) {
    return (
      <>
        <span style={{ color: prefixColor, opacity: prefixColor ? 1 : 0.85, fontSize: "0.6em", fontWeight: 600, marginRight: "4px", verticalAlign: "baseline" }}>{match[1]}</span>
        {match[2]}
      </>
    );
  }
  return <>{formatted}</>;
};
