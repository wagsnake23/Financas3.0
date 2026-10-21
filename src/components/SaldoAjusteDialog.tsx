import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import DynamicIcon from "@/components/DynamicIcon";
import { useCategories } from "@/hooks/useCategories";
import { useProfile } from "@/hooks/useProfile";
import { AppCategory } from "@/types/finance";

interface SaldoAjusteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  saldoCalculadoSistema: number;
  saldoAtualComAjuste: number;
  userId: string;
  onAjusteSalvo: () => void;
  isMobile: boolean;
  allExpenseInstallments?: any[];
  allRevenues?: any[];
  categories?: AppCategory[];
  profile?: any;
}

interface ExtratoItem {
  id: string;
  type: "expense" | "income" | "adjustment";
  effectiveDate: Date;
  dateOnlyStr: string;
  secondaryTimestamp?: number;
  title: string;
  secondary?: string;
  amount: number;
  isPositive: boolean;
  icon: string;
  iconColor?: string;
  formattedDate: string;
  formattedAmount: string;
}

function parseDateParts(dateStr: string): { date: Date; dateOnlyStr: string; timestamp: number } {
  const isDateTime = dateStr.includes("T") || dateStr.includes(" ");
  if (isDateTime) {
    const isoString = dateStr.includes(" ") ? dateStr.replace(" ", "T") : dateStr;
    const d = new Date(isoString);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return {
        date: d,
        dateOnlyStr: `${y}-${m}-${day}`,
        timestamp: d.getTime(),
      };
    }
  }

  const cleanStr = dateStr.split("T")[0].split(" ")[0];
  const parts = cleanStr.split("-").map(Number);
  if (parts.length === 3) {
    const localDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    return {
      date: localDate,
      dateOnlyStr: cleanStr,
      timestamp: localDate.getTime(),
    };
  }

  const fallback = new Date(dateStr);
  return {
    date: fallback,
    dateOnlyStr: cleanStr,
    timestamp: isNaN(fallback.getTime()) ? 0 : fallback.getTime(),
  };
}

function formatExtratoDate(date: Date): string {
  try {
    const day = format(date, "dd", { locale: ptBR });
    const mmmRaw = format(date, "MMM", { locale: ptBR });
    const mmm = mmmRaw.charAt(0).toUpperCase() + mmmRaw.slice(1).replace(".", "");
    return `${day} ${mmm}`;
  } catch {
    return "";
  }
}

export const SaldoAjusteDialog: React.FC<SaldoAjusteDialogProps> = ({
  isOpen,
  onOpenChange,
  saldoCalculadoSistema,
  saldoAtualComAjuste,
  userId,
  onAjusteSalvo,
  isMobile,
  allExpenseInstallments: propsExpenses,
  allRevenues: propsRevenues,
  categories: propsCategories,
  profile: propsProfile,
}) => {
  const [saldoInformadoStr, setSaldoInformadoStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const queryClient = useQueryClient();

  // Histórico individual de ajustes manuais de saldo
  const { data: historicoAjustes = [] } = useQuery({
    queryKey: ["historicoAjustesSaldo", userId],
    queryFn: async () => {
      if (!userId) return [];
      try {
        const { data, error } = await supabase
          .from("historico_ajustes_saldo")
          .select("id, valor_ajuste, created_at, saldo_anterior, saldo_informado")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);
        if (error) {
          console.warn("historico_ajustes_saldo warning:", error.message);
          return [];
        }
        return data || [];
      } catch {
        return [];
      }
    },
    enabled: isOpen && !!userId,
  });

  // Fallback queries if data is not passed via props
  const { data: queryExpenses = [] } = useQuery({
    queryKey: ["recentPaidExpenses", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("despesas_parcelas")
        .select("id, valor_parcela, vencimento, data_pagamento, created_at, updated_at, pago, despesas!inner(id, descricao, categoria_id, user_id)")
        .eq("despesas.user_id", userId)
        .eq("pago", true)
        .order("data_pagamento", { ascending: false, nullsFirst: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !propsExpenses && !!userId,
  });

  const { data: queryRevenues = [] } = useQuery({
    queryKey: ["recentReceivedRevenues", userId],
    queryFn: async () => {
      if (!userId) return [];
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("receitas")
        .select("id, valor, data, descricao, tipo_receita_id, created_at, updated_at, status")
        .eq("user_id", userId)
        .eq("status", "Recebida")
        .lte("data", todayStr)
        .order("data", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !propsRevenues && !!userId,
  });

  const { data: queryCategories = [] } = useCategories(propsCategories ? undefined : userId);
  const { data: queryProfile } = useProfile(propsProfile ? undefined : userId);

  const effectiveExpenses = propsExpenses || queryExpenses;
  const effectiveRevenues = propsRevenues || queryRevenues;
  const effectiveCategories = propsCategories || queryCategories;
  const effectiveProfile = propsProfile || queryProfile;

  const categoriesMap = useMemo(() => {
    const map = new Map<string, { nome: string; icone?: string; cor?: string }>();
    if (Array.isArray(effectiveCategories)) {
      effectiveCategories.forEach((cat) => {
        if (cat?.id) {
          map.set(cat.id, {
            nome: cat.nome,
            icone: cat.icone,
            cor: cat.cor,
          });
        }
      });
    }
    return map;
  }, [effectiveCategories]);

  const ultimasMovimentacoes = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const items: ExtratoItem[] = [];

    // 1. Despesas pagas
    if (Array.isArray(effectiveExpenses)) {
      for (const p of effectiveExpenses) {
        if (!p.pago) continue;

        const dateRaw = p.data_pagamento || p.vencimento;
        if (!dateRaw) continue;

        const { date, dateOnlyStr, timestamp } = parseDateParts(dateRaw);
        if (dateOnlyStr > todayStr) continue; // Não incluir registros futuros

        const category = p.despesas?.categoria_id ? categoriesMap.get(p.despesas.categoria_id) : undefined;
        const title = p.despesas?.descricao || category?.nome || "Despesa";
        const icon = category?.icone || "TrendingDown";
        const iconColor = category?.cor || "#DC2626";
        const formattedDate = formatExtratoDate(date);
        const formattedAmount = `− ${formatCurrency(p.valor_parcela || 0)}`;

        const secTimestamp = p.data_pagamento
          ? timestamp
          : (p.updated_at ? new Date(p.updated_at).getTime() : (p.created_at ? new Date(p.created_at).getTime() : timestamp));

        items.push({
          id: `expense-${p.id}`,
          type: "expense",
          effectiveDate: date,
          dateOnlyStr,
          secondaryTimestamp: secTimestamp,
          title,
          secondary: "Despesa paga",
          amount: p.valor_parcela || 0,
          isPositive: false,
          icon,
          iconColor,
          formattedDate,
          formattedAmount,
        });
      }
    }

    // 2. Receitas recebidas
    if (Array.isArray(effectiveRevenues)) {
      for (const r of effectiveRevenues) {
        if (r.status !== "Recebida") continue;
        if (!r.data || r.data === "1900-01-01") continue;

        const { date, dateOnlyStr, timestamp } = parseDateParts(r.data);
        if (dateOnlyStr > todayStr) continue; // Não incluir registros futuros

        const category = r.tipo_receita_id ? categoriesMap.get(r.tipo_receita_id) : undefined;
        const title = r.descricao || category?.nome || "Receita";
        const icon = category?.icone || "TrendingUp";
        const iconColor = category?.cor || "#059669";
        const formattedDate = formatExtratoDate(date);
        const formattedAmount = `+ ${formatCurrency(r.valor || 0)}`;

        const secTimestamp = r.updated_at
          ? new Date(r.updated_at).getTime()
          : (r.created_at ? new Date(r.created_at).getTime() : timestamp);

        items.push({
          id: `revenue-${r.id}`,
          type: "income",
          effectiveDate: date,
          dateOnlyStr,
          secondaryTimestamp: secTimestamp,
          title,
          secondary: "Receita recebida",
          amount: r.valor || 0,
          isPositive: true,
          icon,
          iconColor,
          formattedDate,
          formattedAmount,
        });
      }
    }

    // 3. Ajustes manuais individuais registrados em historico_ajustes_saldo
    if (Array.isArray(historicoAjustes)) {
      for (const h of historicoAjustes) {
        const valor = Number(h.valor_ajuste) || 0;
        if (valor === 0) continue;

        const dateRaw = h.created_at;
        if (!dateRaw) continue;

        const { date, dateOnlyStr, timestamp } = parseDateParts(dateRaw);
        if (dateOnlyStr > todayStr) continue;

        const isPositive = valor > 0;
        const formattedDate = formatExtratoDate(date);
        const formattedAmount = isPositive
          ? `+ ${formatCurrency(valor)}`
          : `− ${formatCurrency(Math.abs(valor))}`;

        items.push({
          id: `adjustment-${h.id}`,
          type: "adjustment",
          effectiveDate: date,
          dateOnlyStr,
          secondaryTimestamp: timestamp,
          title: "Ajuste manual",
          secondary: "Ajuste de saldo",
          amount: Math.abs(valor),
          isPositive,
          icon: "Wallet",
          iconColor: "#2563EB",
          formattedDate,
          formattedAmount,
        });
      }
    }

    // 1. Ordenação decrescente para selecionar as movimentações elegíveis mais recentes
    items.sort((a, b) => {
      if (a.dateOnlyStr !== b.dateOnlyStr) {
        return b.dateOnlyStr.localeCompare(a.dateOnlyStr);
      }
      const timeA = a.secondaryTimestamp || 0;
      const timeB = b.secondaryTimestamp || 0;
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      return b.id.localeCompare(a.id);
    });

    // 2. Selecionar as até 5 mais recentes
    const top5MaisRecentes = items.slice(0, 5);

    // 3. Inverter para apresentar em ordem cronológica crescente (da mais antiga para a mais recente)
    return top5MaisRecentes.reverse();
  }, [effectiveExpenses, effectiveRevenues, historicoAjustes, categoriesMap]);

  // Clear state when opened
  useEffect(() => {
    if (isOpen) {
      setSaldoInformadoStr("");
      setError(false);
    }
  }, [isOpen]);

  const saldoInformado = parseFloat(saldoInformadoStr.replace(/\./g, "").replace(",", ".")) || 0;
  const isPristine = saldoInformadoStr.trim() === "";
  const diferencaVisual = saldoInformado - saldoAtualComAjuste;
  
  const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value === "") {
      setSaldoInformadoStr("");
      setError(true);
      return;
    }
    setError(false);
    
    // Parse as integer cents, then format
    const numericValue = parseInt(value, 10);
    const decimalValue = numericValue / 100;
    
    // format to pt-BR string like "1.234,56"
    const formatted = new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(decimalValue);
    
    setSaldoInformadoStr(formatted);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPristine) {
      setError(true);
      return;
    }

    setLoading(true);
    try {
      // Execução atômica e transacional exclusivamente via RPC no Supabase
      const { error: rpcError } = await (supabase.rpc as any)("registrar_ajuste_saldo", {
        p_saldo_informado: saldoInformado,
      });

      if (rpcError) {
        throw rpcError;
      }
      
      toast.success("Saldo ajustado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["historicoAjustesSaldo", userId] });
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      onAjusteSalvo();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao registrar ajuste de saldo via RPC:", err);
      toast.error(err?.message || "Não foi possível registrar o ajuste de saldo. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <style>{`
        .saldo-ajuste-modal > button {
          transform: translate(2px, -5px) !important;
        }
        @media (max-width: 767px) {
          .saldo-ajuste-modal,
          .dialog-mobile.saldo-ajuste-modal {
            top: calc(53% - 20px) !important;
          }
        }
      `}</style>
      <DialogContent 
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "flex flex-col overflow-hidden w-full bg-[#FAFAFA] saldo-ajuste-modal", 
          isMobile ? "dialog-mobile w-[calc(100%-4px)] max-w-[calc(100%-4px)] mx-auto rounded-[16px] max-h-[95dvh] !p-0" : "sm:max-w-[425px] sm:rounded-[14px] !p-0 max-h-[90dvh]"
        )}
      >
        <DialogHeader className={cn("shrink-0 border-b bg-transparent", isMobile ? "border-b-[#E5E7EB] px-5 pt-2.5 pb-2" : "px-5 py-4")}>
          <DialogTitle className="text-[20px] font-extrabold text-slate-800 tracking-tight leading-none text-left flex items-center gap-2">
            💰 Ajustar Saldo Atual
          </DialogTitle>
          <DialogDescription className={cn("text-left text-[14px] text-slate-500 font-medium leading-snug", isMobile ? "mt-1" : "mt-1.5")}>
            Informe o saldo real disponível atualmente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="flex flex-col overflow-hidden">
          <div className={cn("overflow-y-auto px-5 pb-4", isMobile ? "bg-[#FAFAFA] pt-0 space-y-3" : "pt-1.5 space-y-4")}>
            
            {/* Seção: Últimas movimentações */}
            <div className={cn("flex flex-col border-b border-slate-200", isMobile ? "-mt-1 pb-2.5" : "pb-3.5")}>
              <span className={cn("text-[13px] font-bold text-slate-700 tracking-wide", isMobile ? "mb-1" : "mb-1.5")}>
                Últimas movimentações
              </span>

              {ultimasMovimentacoes.length === 0 ? (
                <div className="py-2.5 text-center">
                  <p className="text-[13px] font-medium text-slate-400">
                    Nenhuma movimentação recente
                  </p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100">
                  {ultimasMovimentacoes.map((item) => (
                    <div
                      key={item.id}
                      className={cn("flex items-center justify-between gap-2", isMobile ? "py-1.5" : "py-2")}
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        {/* Coluna da esquerda: Data acima do Ícone */}
                        <div className={cn("flex flex-col items-start shrink-0", isMobile ? "w-[42px]" : "w-[50px]")}>
                          <span className="text-[12px] font-medium text-slate-500 leading-tight">
                            {item.formattedDate}
                          </span>
                          <div className="flex items-center justify-start h-[18px] mt-1">
                            <DynamicIcon
                              name={item.icon}
                              className="w-[17px] h-[17px] shrink-0"
                              style={{ color: item.iconColor }}
                            />
                          </div>
                        </div>

                        {/* Divisória vertical suave em cinza-claro */}
                        <div className={cn("w-[1px] h-[32px] bg-slate-200 shrink-0 my-auto", isMobile ? "ml-1.5 mr-2" : "mx-2.5")} />

                        {/* Descrição e identificação secundária */}
                        <div className="flex flex-col min-w-0 flex-1 justify-center">
                          <span className="text-[13px] font-bold text-slate-700 truncate leading-tight">
                            {item.title}
                          </span>
                          {item.secondary && (
                            <span className="text-[11px] font-medium text-slate-400 truncate leading-none mt-1">
                              {item.secondary}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Valor */}
                      <div className="shrink-0 text-right ml-2">
                        <span
                          className={cn(
                            "text-[14px] font-extrabold tracking-tight whitespace-nowrap",
                            item.isPositive ? "text-emerald-600" : "text-rose-600"
                          )}
                        >
                          {item.formattedAmount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={cn("flex flex-col border-b border-slate-200", isMobile ? "pb-2.5 -mt-[5px]" : "pb-4")}>
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-slate-600 mb-0.5">Saldo Atual</span>
                  <span className="text-[16px] font-extrabold text-slate-800 tracking-tight">{formatCurrency(saldoAtualComAjuste)}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[13px] font-bold text-slate-600 mb-0.5">Ajuste Aplicado</span>
                  <span className={cn(
                    "text-[16px] font-extrabold tracking-tight",
                    isPristine ? "text-slate-500 font-bold" : (diferencaVisual > 0 ? "text-emerald-600" : diferencaVisual < 0 ? "text-rose-600" : "text-slate-600")
                  )}>
                    {!isPristine && diferencaVisual > 0 ? "+ " : ""}{formatCurrency(isPristine ? 0 : diferencaVisual)}
                  </span>
                </div>
              </div>
            </div>

            <div className={cn("space-y-2.5", isMobile ? "-mt-[3px]" : "")}>
              <Label htmlFor="saldoInformado" className="text-[13px] font-bold text-slate-700 tracking-wide">
                Saldo real atual <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-bold text-slate-400">R$</span>
                <Input
                  id="saldoInformado"
                  value={saldoInformadoStr}
                  onChange={handleMoneyChange}
                  placeholder="0,00"
                  className={cn(
                    "pl-10 h-[50px] text-[16px] font-bold transition-all duration-200 rounded-xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium input-white bg-white text-gray-800",
                    error ? "border-red-500 focus-visible:ring-red-200" : "border-slate-200 focus-visible:ring-slate-100 focus-visible:border-slate-300"
                  )}
                  inputMode="numeric"
                />
              </div>
              {error && <span className="text-[11px] font-bold text-red-500 leading-none">Campo obrigatório.</span>}
            </div>



            <div className="grid grid-cols-2 gap-2 w-full pt-1">
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-full rounded-[14px] font-extrabold tracking-[0.5px] border transition-all active:scale-95 text-[15px] h-[44px] flex items-center justify-center bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="w-full rounded-[14px] font-extrabold tracking-[0.5px] text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-[15px] h-[44px] flex items-center justify-center btn-3d"
                style={{ "--cor-topo": "#25AF6A", "--cor-base": "#1AA361" } as any}
                disabled={loading}
              >
                {loading ? "Salvando..." : "Aplicar Ajuste"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
