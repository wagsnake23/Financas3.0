import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Tables } from "@/integrations/supabase/types";
import { format, addMonths, startOfMonth } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type MonthType = "past" | "current" | "future";

interface ExpenseInstallmentWithDespesa extends Tables<"despesas_parcelas"> {
  despesas: Pick<
    Tables<"despesas">,
    | "id"
    | "categoria_id"
    | "user_id"
    | "descricao"
    | "forma_pagamento"
    | "tipo_pagamento"
    | "cartao_id"
    | "is_recurring_master"
    | "numero_parcelas"
  > | null;
}

interface MonthlyBreakdown {
  fixos: number;
  parcelas: number;
  variavel: number;
  realizado: number;
  total: number;
  isProjected: boolean;
}

interface UseFinancialProjectionProps {
  user: User | null;
  allExpenseInstallments: ExpenseInstallmentWithDespesa[];
  allRevenues: Tables<"receitas">[];
  enabled?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Classifies a month as past, current, or future relative to today.
 */
function getMonthType(targetMonth: string): MonthType {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (targetMonth < currentMonthStr) return "past";
  if (targetMonth === currentMonthStr) return "current";
  return "future";
}

/**
 * Generates an array of month strings ("YYYY-MM") for the next N months 
 * starting from the month AFTER the current month.
 */
function getFutureMonthStrings(count: number): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < count; i++) {
    const m = addMonths(startOfMonth(now), i);
    months.push(format(m, "yyyy-MM"));
  }
  return months;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const ORCAMENTO_HORIZON_MONTHS = 120;

export function useFinancialProjection({
  user,
  allExpenseInstallments,
  allRevenues,
  enabled = true,
}: UseFinancialProjectionProps) {
  // 🔍 Fetch all orcamentos for the next 120 months 
  // ============================================================================
  const futureMonths = useMemo(() => getFutureMonthStrings(ORCAMENTO_HORIZON_MONTHS), []);

  const { data: allOrcamentos = [], isLoading: isLoadingOrcamentos } = useQuery<
    Tables<"orcamentos">[]
  >({
    queryKey: ["orcamentos-projection", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let allData: Tables<"orcamentos">[] = [];
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from("orcamentos")
          .select("*")
          .eq("user_id", user.id)
          .in("mes_ano", futureMonths)
          .range(page * pageSize, (page + 1) * pageSize - 1);
          
        if (error) throw error;
        
        if (data) {
          allData = [...allData, ...data];
        }
        
        // Break the loop if we received less than pageSize (meaning no more pages)
        if (!data || data.length < pageSize) {
          break;
        }
        page++;
      }
      
      console.log(
        "[ORCAMENTOS FINAL]",
        allData.length,
        allData[0]?.mes_ano,
        allData[allData.length - 1]?.mes_ano
      );

      return allData;
    },
    enabled: enabled && !!user?.id && futureMonths.length > 0,
  });

  // ── Pre-compute lookup maps ───────────────────────────────────────────────

  /**
   * Map of month → Set<categoria_id> that have fixed or installment obligations.
   * Used for the anti-duplication rule.
   */
  const monthlyObligationCategories = useMemo(() => {
    const map = new Map<string, Set<string>>();

    allExpenseInstallments.forEach((p) => {
      const monthStr = p.vencimento.substring(0, 7); // "YYYY-MM"
      const despesa = p.despesas;
      if (
        despesa?.categoria_id &&
        (despesa.tipo_pagamento === "fixo" || despesa.tipo_pagamento === "parcelado")
      ) {
        if (!map.has(monthStr)) {
          map.set(monthStr, new Set());
        }
        map.get(monthStr)!.add(despesa.categoria_id);
      }
    });

    return map;
  }, [allExpenseInstallments]);

  /**
   * Map of month → total of existing parcels (all types: avista, fixo, parcelado).
   */
  const monthlyInstalledExpenses = useMemo(() => {
    const map = new Map<string, number>();

    allExpenseInstallments.forEach((p) => {
      const monthStr = p.vencimento.substring(0, 7);
      map.set(monthStr, (map.get(monthStr) || 0) + p.valor_parcela);
    });

    return map;
  }, [allExpenseInstallments]);

  /**
   * Map of month → total of existing revenues.
   */
  const monthlyRevenueMap = useMemo(() => {
    const map = new Map<string, number>();

    allRevenues.forEach((r) => {
      if (r.data === "1900-01-01") return; // Skip placeholder dates
      const monthStr = r.data.substring(0, 7);
      map.set(monthStr, (map.get(monthStr) || 0) + r.valor);
    });

    return map;
  }, [allRevenues]);

  /**
   * Map of month → orcamentos for that month, keyed by categoria_id.
   */
  const monthlyOrcamentosMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>();

    allOrcamentos.forEach((o) => {
      if (!map.has(o.mes_ano)) {
        map.set(o.mes_ano, new Map());
      }
      if (o.valor_planejado > 0) {
        map.get(o.mes_ano)!.set(o.categoria_id, o.valor_planejado);
      }
    });

    return map;
  }, [allOrcamentos]);

  console.log(
    "[ORCAMENTOS MAP]",
    monthlyOrcamentosMap.size,
    monthlyOrcamentosMap.has("2027-07"),
    monthlyOrcamentosMap.get("2027-07")
  );

  // ── Expense breakdown by month (fixed + parcels) ──────────────────────────

  const monthlyFixedExpenses = useMemo(() => {
    const map = new Map<string, number>();

    allExpenseInstallments.forEach((p) => {
      const monthStr = p.vencimento.substring(0, 7);
      const despesa = p.despesas;
      if (despesa?.tipo_pagamento === "fixo") {
        map.set(monthStr, (map.get(monthStr) || 0) + p.valor_parcela);
      }
    });

    return map;
  }, [allExpenseInstallments]);

  const monthlyInstallmentExpenses = useMemo(() => {
    const map = new Map<string, number>();

    allExpenseInstallments.forEach((p) => {
      const monthStr = p.vencimento.substring(0, 7);
      const despesa = p.despesas;
      if (despesa?.tipo_pagamento === "parcelado") {
        map.set(monthStr, (map.get(monthStr) || 0) + p.valor_parcela);
      }
    });

    return map;
  }, [allExpenseInstallments]);

  // ── Core calculation functions ────────────────────────────────────────────

  /**
   * Returns total expenses for a given month, applying the temporal rule:
   * - past/current: only realized (despesas_parcelas)
   * - future: fixos + parcelas + variable planning (with anti-duplication)
   */
  const getMonthlyExpenses = useMemo(() => {
    console.log('[MEMO RECALCULADO]', 'getMonthlyExpenses (Closure Creator)', new Date().toISOString());
    return (monthStr: string): number => {
      const type = getMonthType(monthStr);

      if (type === "past" || type === "current") {
        // Only realized data
        return monthlyInstalledExpenses.get(monthStr) || 0;
      }

      // Future: fixed + installment parcels already in despesas_parcelas
      const fixos = monthlyFixedExpenses.get(monthStr) || 0;
      const parcelas = monthlyInstallmentExpenses.get(monthStr) || 0;

      // One-off "avista" expenses in the future (already created)
      const avistaFuture = allExpenseInstallments
        .filter((p) => {
          const m = p.vencimento.substring(0, 7);
          return m === monthStr && p.despesas?.tipo_pagamento === "avista";
        })
        .reduce((sum, p) => sum + p.valor_parcela, 0);

      // Variable planning from orcamentos (anti-duplication applied)
      const orcamentosForMonth = monthlyOrcamentosMap.get(monthStr);
      const obligationCats = monthlyObligationCategories.get(monthStr) || new Set<string>();

      if (monthStr === "2027-07") {
        let orcCount = orcamentosForMonth ? orcamentosForMonth.size : 0;
        let orcTotal = 0;
        if (orcamentosForMonth) {
          for (let val of orcamentosForMonth.values()) orcTotal += val;
        }

        let fixosCount = 0;
        let parcelasCount = 0;
        let avistaCount = 0;

        allExpenseInstallments.forEach(p => {
          if (p.vencimento.substring(0, 7) === "2027-07") {
            if (p.despesas?.tipo_pagamento === "fixo") fixosCount++;
            else if (p.despesas?.tipo_pagamento === "parcelado") parcelasCount++;
            else if (p.despesas?.tipo_pagamento === "avista") avistaCount++;
          }
        });

        let variavelFiltered = 0;
        if (orcamentosForMonth) {
          orcamentosForMonth.forEach((valor, catId) => {
            if (!obligationCats.has(catId)) variavelFiltered += valor;
          });
        }

        console.log("====================================");
        console.log("VALIDAÇÃO JUL/2027");
        console.log("====================================");
        console.log("");
        console.log("1. Total de orçamentos encontrados:");
        console.log("- quantidade de subcategorias:", orcCount);
        console.log("- valor total planejado:", orcTotal);
        console.log("");
        console.log("2. Total de despesas fixas encontradas:");
        console.log("- quantidade:", fixosCount);
        console.log("- valor total:", fixos);
        console.log("");
        console.log("3. Total de parcelamentos encontrados:");
        console.log("- quantidade:", parcelasCount);
        console.log("- valor total:", parcelas);
        console.log("");
        console.log("4. Total de despesas futuras avulsas encontradas:");
        console.log("- quantidade:", avistaCount);
        console.log("- valor total:", avistaFuture);
        console.log("");
        console.log("5. Valor final retornado por:");
        console.log(`getMonthlyExpenses("2027-07")`);
        console.log("");
        console.log("6. Mostrar a composição completa:");
        console.log("");
        console.log(`Orçamentos: R$ ${variavelFiltered} (após anti-duplicidade)`);
        console.log(`Fixas: R$ ${fixos}`);
        console.log(`Parcelamentos: R$ ${parcelas}`);
        console.log(`Avulsas: R$ ${avistaFuture}`);
        console.log("");
        console.log(`Total Final: R$ ${fixos + parcelas + avistaFuture + variavelFiltered}`);
        console.log("");
        console.log("====================================");
      }

      let variavel = 0;
      if (orcamentosForMonth) {
        orcamentosForMonth.forEach((valor, catId) => {
          // Anti-duplication: only include if category has NO fixed/installment obligation
          if (!obligationCats.has(catId)) {
            variavel += valor;
          }
        });
      }

      return fixos + parcelas + avistaFuture + variavel;
    };
  }, [
    monthlyInstalledExpenses,
    monthlyFixedExpenses,
    monthlyInstallmentExpenses,
    monthlyOrcamentosMap,
    monthlyObligationCategories,
    allExpenseInstallments,
  ]);

  /**
   * Returns total revenues for a given month.
   * Both past/current and future use the same source (receitas table),
   * since recurring revenues already generate future entries.
   */
  const getMonthlyRevenues = useMemo(() => {
    return (monthStr: string): number => {
      return monthlyRevenueMap.get(monthStr) || 0;
    };
  }, [monthlyRevenueMap]);

  /**
   * Returns balance (revenues - expenses) for a given month.
   */
  const getMonthlyBalance = useMemo(() => {
    return (monthStr: string): number => {
      return getMonthlyRevenues(monthStr) - getMonthlyExpenses(monthStr);
    };
  }, [getMonthlyRevenues, getMonthlyExpenses]);

  /**
   * Returns a detailed breakdown for a given month.
   */
  const getMonthlyBreakdown = useMemo(() => {
    return (monthStr: string): MonthlyBreakdown => {
      const type = getMonthType(monthStr);
      const isProjected = type === "future";

      if (!isProjected) {
        const realizado = monthlyInstalledExpenses.get(monthStr) || 0;
        return {
          fixos: 0,
          parcelas: 0,
          variavel: 0,
          realizado,
          total: realizado,
          isProjected: false,
        };
      }

      const fixos = monthlyFixedExpenses.get(monthStr) || 0;
      const parcelas = monthlyInstallmentExpenses.get(monthStr) || 0;

      const avistaFuture = allExpenseInstallments
        .filter((p) => {
          const m = p.vencimento.substring(0, 7);
          return m === monthStr && p.despesas?.tipo_pagamento === "avista";
        })
        .reduce((sum, p) => sum + p.valor_parcela, 0);

      const orcamentosForMonth = monthlyOrcamentosMap.get(monthStr);
      const obligationCats = monthlyObligationCategories.get(monthStr) || new Set<string>();

      let variavel = 0;
      if (orcamentosForMonth) {
        orcamentosForMonth.forEach((valor, catId) => {
          if (!obligationCats.has(catId)) {
            variavel += valor;
          }
        });
      }

      const total = fixos + parcelas + avistaFuture + variavel;
      return {
        fixos,
        parcelas: parcelas + avistaFuture,
        variavel,
        realizado: 0,
        total,
        isProjected: true,
      };
    };
  }, [
    monthlyInstalledExpenses,
    monthlyFixedExpenses,
    monthlyInstallmentExpenses,
    monthlyOrcamentosMap,
    monthlyObligationCategories,
    allExpenseInstallments,
  ]);

  /**
   * Returns total for a year (sum of 12 months).
   */
  const getAnnualExpenses = useMemo(() => {
    return (year: number): number => {
      let total = 0;
      for (let m = 0; m < 12; m++) {
        const monthStr = `${year}-${String(m + 1).padStart(2, "0")}`;
        total += getMonthlyExpenses(monthStr);
      }
      return total;
    };
  }, [getMonthlyExpenses]);

  const getAnnualRevenues = useMemo(() => {
    return (year: number): number => {
      let total = 0;
      for (let m = 0; m < 12; m++) {
        const monthStr = `${year}-${String(m + 1).padStart(2, "0")}`;
        total += getMonthlyRevenues(monthStr);
      }
      return total;
    };
  }, [getMonthlyRevenues]);

  const getAnnualBalance = useMemo(() => {
    return (year: number): number => {
      return getAnnualRevenues(year) - getAnnualExpenses(year);
    };
  }, [getAnnualRevenues, getAnnualExpenses]);

  /**
   * Returns whether a given month is a projected (future) month.
   */
  const isMonthProjected = useMemo(() => {
    return (monthStr: string): boolean => {
      return getMonthType(monthStr) === "future";
    };
  }, []);

  /**
   * Returns expense total for a specific category in a given month.
   * For past/current: only realized. For future: obligation or planning (anti-dup).
   */
  const getCategoryExpenses = useMemo(() => {
    return (monthStr: string, categoryId: string): number => {
      const type = getMonthType(monthStr);

      if (type === "past" || type === "current") {
        // Sum from parcels for this category
        return allExpenseInstallments
          .filter(
            (p) =>
              p.vencimento.substring(0, 7) === monthStr &&
              p.despesas?.categoria_id === categoryId
          )
          .reduce((sum, p) => sum + p.valor_parcela, 0);
      }

      // Future: check if category has obligation
      const hasObligation = allExpenseInstallments.some(
        (p) =>
          p.vencimento.substring(0, 7) === monthStr &&
          p.despesas?.categoria_id === categoryId &&
          (p.despesas?.tipo_pagamento === "fixo" || p.despesas?.tipo_pagamento === "parcelado")
      );

      if (hasObligation) {
        // Use the obligation value
        return allExpenseInstallments
          .filter(
            (p) =>
              p.vencimento.substring(0, 7) === monthStr &&
              p.despesas?.categoria_id === categoryId
          )
          .reduce((sum, p) => sum + p.valor_parcela, 0);
      }

      // No obligation: check planning
      const orcamentosForMonth = monthlyOrcamentosMap.get(monthStr);
      if (orcamentosForMonth?.has(categoryId)) {
        return orcamentosForMonth.get(categoryId)!;
      }

      // Also check for avista expenses already registered in future
      return allExpenseInstallments
        .filter(
          (p) =>
            p.vencimento.substring(0, 7) === monthStr &&
            p.despesas?.categoria_id === categoryId
        )
        .reduce((sum, p) => sum + p.valor_parcela, 0);
    };
  }, [allExpenseInstallments, monthlyOrcamentosMap]);

  /**
   * Returns the set of subcategory IDs that have active fixed/installment
   * obligations for a given month. Used by the Orcamentos modal to determine
   * which subcategories should be auto-filled.
   */
  const getObligationCategories = useMemo(() => {
    return (monthStr: string): Set<string> => {
      return monthlyObligationCategories.get(monthStr) || new Set<string>();
    };
  }, [monthlyObligationCategories]);

  /**
   * Returns the obligation value for a specific subcategory in a given month.
   * Returns 0 if no obligation exists.
   */
  const getObligationValue = useMemo(() => {
    return (monthStr: string, categoryId: string): number => {
      return allExpenseInstallments
        .filter(
          (p) =>
            p.vencimento.substring(0, 7) === monthStr &&
            p.despesas?.categoria_id === categoryId &&
            (p.despesas?.tipo_pagamento === "fixo" || p.despesas?.tipo_pagamento === "parcelado")
        )
        .reduce((sum, p) => sum + p.valor_parcela, 0);
    };
  }, [allExpenseInstallments]);

  /**
   * Computes trend percentages between two months.
   */
  const getMonthlyTrends = useMemo(() => {
    return (currentMonthStr: string, previousMonthStr: string) => {
      const currentIncome = getMonthlyRevenues(currentMonthStr);
      const currentExpenses = getMonthlyExpenses(currentMonthStr);
      const currentBalance = currentIncome - currentExpenses;

      const previousIncome = getMonthlyRevenues(previousMonthStr);
      const previousExpenses = getMonthlyExpenses(previousMonthStr);
      const previousBalance = previousIncome - previousExpenses;

      const calcTrendVar = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return ((curr - prev) / Math.abs(prev)) * 100;
      };

      const incomeVar = calcTrendVar(currentIncome, previousIncome);
      const expenseVar = calcTrendVar(currentExpenses, previousExpenses);
      const balanceVar = calcTrendVar(currentBalance, previousBalance);

      const formatTrend = (val: number) => {
        return `${val > 0 ? "+" : ""}${val.toFixed(0)}%`;
      };

      return {
        incomeTrend: formatTrend(incomeVar),
        incomeIsPositive: currentIncome >= previousIncome,
        expenseTrend: formatTrend(expenseVar),
        expenseIsPositive: currentExpenses >= previousExpenses,
        balanceTrend: formatTrend(balanceVar),
        balanceIsPositive: currentBalance >= previousBalance,
      };
    };
  }, [getMonthlyRevenues, getMonthlyExpenses]);

  return {
    // Core functions
    getMonthlyExpenses,
    getMonthlyRevenues,
    getMonthlyBalance,
    getMonthlyBreakdown,
    getAnnualExpenses,
    getAnnualRevenues,
    getAnnualBalance,
    isMonthProjected,
    getCategoryExpenses,
    getMonthlyTrends,

    // Budget/Obligation helpers for Orcamentos page
    getObligationCategories,
    getObligationValue,

    // Loading state
    isLoadingOrcamentos,
  };
}
