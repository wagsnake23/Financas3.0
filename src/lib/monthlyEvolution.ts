import { addMonths, format, getDaysInMonth, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AppCategory,
  Investment,
  InvestmentContribution,
  InvestmentRedemption,
  InvestmentRedemptionAllocation,
} from "@/types/finance";
import {
  IndexadorHistorico,
  TARGET_TIMEZONE,
  calcularRendimentoComCDI,
  formatInTimeZone,
  getTipoTributacao,
} from "@/lib/utils";
import { roundCurrency, sortAportesFIFO } from "@/lib/investmentsFifo";

export interface MonthlyEvolutionPoint {
  /** Competência no formato YYYY-MM */
  key: string;
  /** Mês abreviado (ex: "Out") */
  label: string;
  /** Mês e ano para tooltip (ex: "Out/2026") */
  fullLabel: string;
  /** Indica se a competência corresponde ao mês atual em andamento (dados parciais) */
  isPartial: boolean;
  /** Taxa mensal do IPCA em percentual (ex: 0.56 = 0,56%; pode ser negativo) */
  ipca: number | null;
  /** Taxa mensal do CDI em percentual (ex: 1.04 = 1,04%) */
  cdi: number | null;
  /** Rentabilidade mensal real líquida da carteira em percentual (ex: 1.12 = 1,12%) */
  portfolio: number | null;
  /** IPCA acumulado composto nos últimos 12 meses (%) até a competência de referência */
  ipca12m: number | null;
  /** CDI acumulado composto nos últimos 12 meses (%) até a competência de referência */
  cdi12m: number | null;
  /** Taxa anual vigente do CDI (taxa_anual em % a.a.) na competência de referência */
  cdiAnnualRate: number | null;
  /** Rentabilidade acumulada composta da carteira nos últimos 12 meses (%) até a competência de referência */
  portfolio12m: number | null;
}

export interface MonthlyEvolutionResult {
  points: MonthlyEvolutionPoint[];
  latest: {
    ipca: number | null;
    cdi: number | null;
    portfolio: number | null;
  };
  hasPortfolioHistory: boolean;
}

interface BuildMonthlyEvolutionParams {
  indexadores: IndexadorHistorico[];
  investments: Investment[];
  aportes: InvestmentContribution[];
  alocacoes: InvestmentRedemptionAllocation[];
  resgates: InvestmentRedemption[];
  allSubcategories: AppCategory[];
  indexadorMapCDI: Map<string, number>;
  indexadorMapIPCA: Map<string, number>;
  /** Mês final da janela de 12 meses (YYYY-MM). Se omitido, utiliza o mês atual em Brasília. */
  windowEndKey?: string;
  referenceDate?: Date;
}

/**
 * Retorna a chave YYYY-MM da competência atual (dinâmica, fuso horário de Brasília).
 */
export function getCurrentMonthKey(referenceDate?: Date): string {
  const nowStr = formatInTimeZone(referenceDate || new Date(), TARGET_TIMEZONE, "yyyy-MM-dd");
  return nowStr.slice(0, 7);
}

/**
 * Calcula a chave YYYY-MM do mês final da janela de 12 meses de forma estável:
 * - Nunca ultrapassa o mês atual (nunca exibe competências futuras).
 * - Mantém a janela padrão terminando no mês atual enquanto `selectedMonth` estiver dentro dos últimos 12 meses.
 * - Desliza a janela para trás caso o usuário navegue para meses mais antigos que a janela padrão.
 */
export function resolveEvolutionWindowEndKey(
  selectedMonth: Date,
  referenceDate?: Date
): string {
  const nowStr = formatInTimeZone(referenceDate || new Date(), TARGET_TIMEZONE, "yyyy-MM-dd");
  const [nowY, nowM] = nowStr.split("-").map(Number);
  const currentMonthStart = new Date(nowY, nowM - 1, 1, 12, 0, 0);
  const defaultWindowStart = subMonths(currentMonthStart, 11);

  const selectedStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1, 12, 0, 0);

  // Nunca avançar a janela do gráfico para competências futuras
  if (selectedStart >= currentMonthStart) {
    return format(currentMonthStart, "yyyy-MM");
  }
  if (selectedStart < defaultWindowStart) {
    return format(addMonths(selectedStart, 11), "yyyy-MM");
  }
  return format(currentMonthStart, "yyyy-MM");
}

function capitalizeMonthAbbr(date: Date): string {
  const raw = format(date, "MMM", { locale: ptBR }).replace(/\.$/, "");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Capitalização composta de exatamente 12 taxas mensais em percentual (%).
 * Fórmula: (∏ (1 + r_i / 100) - 1) * 100.
 * Retorna null quando não houver 12 competências válidas completas (sem inventar valores).
 */
function compound12Months(rates: (number | null | undefined)[]): number | null {
  if (rates.length !== 12) return null;
  let factor = 1;
  for (const r of rates) {
    if (r === null || r === undefined || !Number.isFinite(r)) {
      return null;
    }
    factor *= 1 + r / 100;
  }
  return Number(((factor - 1) * 100).toFixed(4));
}

/**
 * Calcula o acumulado composto de 12 meses de um indexador (IPCA ou CDI) a partir do mapa mensal (%).
 * Nunca utiliza competências futuras (> maxAllowedKey).
 * Quando `allowLatestPublishedFallback` é true (IPCA no mês corrente ainda não divulgado),
 * ancora a janela móvel na última competência efetivamente publicada <= endDate.
 */
function compute12MFromMonthlyMap(
  map: Map<string, number>,
  endDate: Date,
  maxAllowedKey: string,
  allowLatestPublishedFallback: boolean
): number | null {
  if (map.size < 12) return null;

  const endKey = format(endDate, "yyyy-MM");
  const cappedEndKey = endKey > maxAllowedKey ? maxAllowedKey : endKey;

  let refDate: Date | null = null;
  if (map.has(cappedEndKey)) {
    const [y, m] = cappedEndKey.split("-").map(Number);
    refDate = new Date(y, (m || 1) - 1, 1, 12, 0, 0);
  } else if (allowLatestPublishedFallback) {
    let latestKey: string | null = null;
    for (const k of map.keys()) {
      if (k <= cappedEndKey && (latestKey === null || k > latestKey)) {
        latestKey = k;
      }
    }
    if (latestKey) {
      const [y, m] = latestKey.split("-").map(Number);
      refDate = new Date(y, (m || 1) - 1, 1, 12, 0, 0);
    }
  }

  if (!refDate) return null;

  const rates: (number | null)[] = [];
  for (let i = 11; i >= 0; i--) {
    const k = format(subMonths(refDate, i), "yyyy-MM");
    if (k > maxAllowedKey) return null;
    const val = map.get(k);
    rates.push(val !== undefined && Number.isFinite(val) ? val : null);
  }

  return compound12Months(rates);
}

/**
 * Extrai mapa YYYY-MM -> taxa mensal em percentual (%) para um indexador (IPCA ou CDI).
 * Na tabela public.indexadores, `taxa_mensal` é armazenada em formato decimal (ex: 0.0056 = 0,56%).
 */
function buildMonthlyIndexerPercentMap(
  indexadores: IndexadorHistorico[],
  tipo: "IPCA" | "CDI"
): Map<string, number> {
  const result = new Map<string, number>();
  const rows = (indexadores || []).filter((i) => i.tipo === tipo && Boolean(i.data_inicio));

  if (rows.length === 0) return result;

  // 1. Prioriza registros com taxa_mensal preenchida
  const rowsWithMonthly = rows.filter(
    (i) => i.taxa_mensal !== null && i.taxa_mensal !== undefined && Number.isFinite(Number(i.taxa_mensal))
  );

  if (rowsWithMonthly.length > 0) {
    // Se houver registros marcados explicitamente como periodicidade 'mensal', utiliza somente eles
    const explicitMonthly = rowsWithMonthly.filter(
      (i) => i.periodicidade && i.periodicidade.toLowerCase() === "mensal"
    );
    const source = explicitMonthly.length > 0 ? explicitMonthly : rowsWithMonthly;

    const sorted = [...source].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
    for (const item of sorted) {
      const key = item.data_inicio.slice(0, 7); // YYYY-MM
      result.set(key, Number(item.taxa_mensal) * 100);
    }
    return result;
  }

  // 2. Fallback exclusivo para CDI caso a tabela possua apenas registros diários (sem taxa_mensal)
  if (tipo === "CDI") {
    const dailyByMonth = new Map<string, number[]>();
    const sortedDaily = [...rows]
      .filter((i) => i.taxa_diaria !== null && i.taxa_diaria !== undefined && Number.isFinite(Number(i.taxa_diaria)))
      .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

    // Garante deduplicação por dia
    const uniqueDayMap = new Map<string, number>();
    for (const item of sortedDaily) {
      const dayKey = item.data_inicio.split("T")[0];
      uniqueDayMap.set(dayKey, Number(item.taxa_diaria));
    }

    for (const [dayKey, taxaDiaria] of uniqueDayMap.entries()) {
      const monthKey = dayKey.slice(0, 7);
      const list = dailyByMonth.get(monthKey) || [];
      list.push(taxaDiaria);
      dailyByMonth.set(monthKey, list);
    }

    for (const [monthKey, rates] of dailyByMonth.entries()) {
      if (rates.length === 0) continue;
      let fator = 1;
      for (const r of rates) {
        fator *= 1 + r;
      }
      result.set(monthKey, (fator - 1) * 100);
    }
  }

  return result;
}

/**
 * Extrai mapa ordenado YYYY-MM -> taxa_anual (% a.a.) vigente do CDI em cada competência.
 * Ignora registros futuros (> maxAllowedDateStr) e, havendo múltiplos registros no mesmo mês,
 * mantém o mais recente dentro da competência.
 */
function buildCdiAnnualRateByMonthMap(
  indexadores: IndexadorHistorico[],
  maxAllowedDateStr: string
): Map<string, number> {
  const result = new Map<string, number>();
  const rows = (indexadores || [])
    .filter(
      (i) =>
        i.tipo === "CDI" &&
        Boolean(i.data_inicio) &&
        i.data_inicio.split("T")[0] <= maxAllowedDateStr &&
        i.taxa_anual !== null &&
        i.taxa_anual !== undefined &&
        Number.isFinite(Number(i.taxa_anual))
    )
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

  for (const item of rows) {
    const monthKey = item.data_inicio.slice(0, 7);
    result.set(monthKey, Number(item.taxa_anual));
  }

  return result;
}

/**
 * Resolve a taxa anual vigente do CDI (% a.a.) para uma competência YYYY-MM.
 * Se não houver registro exatamente na competência, utiliza o último registro válido anterior.
 */
function resolveCdiAnnualRateForMonth(
  cdiAnnualMap: Map<string, number>,
  monthKey: string,
  maxAllowedMonthKey: string
): number | null {
  if (cdiAnnualMap.size === 0) return null;
  const targetKey = monthKey > maxAllowedMonthKey ? maxAllowedMonthKey : monthKey;

  const exact = cdiAnnualMap.get(targetKey);
  if (exact !== undefined && Number.isFinite(exact)) {
    return Number(exact.toFixed(4));
  }

  let latestPrevKey: string | null = null;
  for (const k of cdiAnnualMap.keys()) {
    if (k <= targetKey && (latestPrevKey === null || k > latestPrevKey)) {
      latestPrevKey = k;
    }
  }

  if (!latestPrevKey) return null;
  const fallbackVal = cdiAnnualMap.get(latestPrevKey);
  return fallbackVal !== undefined && Number.isFinite(fallbackVal)
    ? Number(fallbackVal.toFixed(4))
    : null;
}

/**
 * Calcula a série histórica mensal dos últimos 12 meses completos para:
 * - IPCA (public.indexadores -> taxa_mensal)
 * - CDI (public.indexadores -> taxa_mensal, com fallback composto diário apenas se ausente)
 * - Meus investimentos (rentabilidade mensal real da carteira reutilizando calcularRendimentoComCDI)
 */
export function buildMonthlyEvolutionData({
  indexadores,
  investments,
  aportes,
  alocacoes,
  resgates,
  allSubcategories,
  indexadorMapCDI,
  indexadorMapIPCA,
  windowEndKey,
  referenceDate,
}: BuildMonthlyEvolutionParams): MonthlyEvolutionResult {
  // Referência dinâmica em horário de Brasília (nunca exibe competências futuras)
  const nowStr = formatInTimeZone(referenceDate || new Date(), TARGET_TIMEZONE, "yyyy-MM-dd");
  const [nowY, nowM, nowD] = nowStr.split("-").map(Number);
  const currentMonthStart = new Date(nowY, nowM - 1, 1, 12, 0, 0);
  const currentMonthKey = format(currentMonthStart, "yyyy-MM");

  let windowEndMonth = currentMonthStart;
  if (windowEndKey && /^\d{4}-\d{2}$/.test(windowEndKey)) {
    const [endY, endM] = windowEndKey.split("-").map(Number);
    const parsedEnd = new Date(endY, endM - 1, 1, 12, 0, 0);
    // Garantia estrita: nunca ultrapassar o mês atual
    windowEndMonth = parsedEnd > currentMonthStart ? currentMonthStart : parsedEnd;
  }

  const ipcaMap = buildMonthlyIndexerPercentMap(indexadores, "IPCA");
  const cdiMap = buildMonthlyIndexerPercentMap(indexadores, "CDI");
  const cdiAnnualMap = buildCdiAnnualRateByMonthMap(indexadores, nowStr);

  // Se o mês final for o mês atual, verificar se há algum dado parcial disponível nele.
  // Caso não exista nenhum dado no mês atual (nem IPCA, nem CDI, nem aporte ativo antes de hoje),
  // recuar o fim da janela para o último mês completo (dados fechados).
  if (format(windowEndMonth, "yyyy-MM") === currentMonthKey) {
    const hasCurrentIndexerData = ipcaMap.has(currentMonthKey) || cdiMap.has(currentMonthKey);
    const hasActiveAporteInCurrentMonth = (aportes || []).some(
      (ap) => ap.data_aporte && ap.data_aporte.split("T")[0] < nowStr
    ) || (investments || []).some(
      (inv) => inv.status !== "resgatado" && inv.data && inv.data.split("T")[0] < nowStr
    );
    if (!hasCurrentIndexerData && !hasActiveAporteInCurrentMonth) {
      windowEndMonth = subMonths(currentMonthStart, 1);
    }
  }

  // Calcula 23 meses internamente (11 meses de lookback + 12 meses visíveis no gráfico)
  // para permitir o acumulado composto móvel de 12 meses da carteira para qualquer mês selecionado,
  // reutilizando exatamente a mesma metodologia (FIFO + Modified Dietz + boundaryValueCache).
  const LOOKBACK_MONTHS = 11;
  const TOTAL_MONTHS = 12 + LOOKBACK_MONTHS;

  const months: {
    date: Date;
    key: string;
    label: string;
    fullLabel: string;
    startStr: string;
    nextStartStr: string;
    effectiveEndStr: string;
    isPartial: boolean;
    effectiveDaysInMonth: number;
  }[] = [];

  for (let i = TOTAL_MONTHS - 1; i >= 0; i--) {
    const mDate = subMonths(startOfMonth(windowEndMonth), i);
    const nextDate = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 1, 12, 0, 0);
    const key = format(mDate, "yyyy-MM");
    const abbr = capitalizeMonthAbbr(mDate);
    const startStr = `${key}-01`;
    const nextStartStr = format(nextDate, "yyyy-MM-01");
    const isCurrentMonth = key === currentMonthKey;
    const daysInMonth = getDaysInMonth(mDate);

    months.push({
      date: mDate,
      key,
      label: abbr,
      fullLabel: `${abbr}/${mDate.getFullYear()}`,
      startStr,
      nextStartStr,
      // No mês em andamento, limita o cálculo até a data atual sem projetar dias futuros
      effectiveEndStr: isCurrentMonth ? nowStr : nextStartStr,
      isPartial: isCurrentMonth,
      effectiveDaysInMonth: isCurrentMonth ? Math.max(1, nowD) : daysInMonth,
    });
  }

  // Mapa rápido resgate_id -> data_resgate (YYYY-MM-DD)
  const resgateDateMap = new Map<string, string>();
  for (const r of resgates || []) {
    if (r.id && r.data_resgate) {
      resgateDateMap.set(r.id, r.data_resgate.split("T")[0]);
    }
  }

  // Pré-processar aportes e alocações por investimento (indexação O(1) por aporte_id)
  const aportesByInvId = new Map<string, InvestmentContribution[]>();
  for (const ap of aportes || []) {
    const list = aportesByInvId.get(ap.investimento_id) || [];
    list.push(ap);
    aportesByInvId.set(ap.investimento_id, list);
  }

  const alocacoesByAporteId = new Map<string, InvestmentRedemptionAllocation[]>();
  for (const al of alocacoes || []) {
    const list = alocacoesByAporteId.get(al.aporte_id) || [];
    list.push(al);
    alocacoesByAporteId.set(al.aporte_id, list);
  }

  const preparedInvestments = (investments || []).map((inv) => {
    const aportesDoInv = aportesByInvId.get(inv.id) || [];
    const aportesEfetivos: InvestmentContribution[] =
      aportesDoInv.length > 0
        ? [...aportesDoInv].sort(sortAportesFIFO)
        : [
            {
              id: `virtual-${inv.id}`,
              investimento_id: inv.id,
              user_id: inv.user_id,
              valor_original: inv.valor,
              data_aporte: inv.data,
              created_at: inv.created_at || new Date().toISOString(),
            },
          ];

    const tipoTributacao = getTipoTributacao(inv, allSubcategories);

    let idxMap = new Map<string, number>();
    if (inv.tipo_rentabilidade === "indexado") {
      if (inv.indexador === "CDI") idxMap = indexadorMapCDI;
      else if (inv.indexador === "IPCA") idxMap = indexadorMapIPCA;
    }

    const pIndexador =
      inv.tipo_rentabilidade === "indexado" ? inv.percentual_indexador || 100 : 100;
    const taxaFixaAnual = inv.tipo_rentabilidade === "fixo" ? inv.taxa_fixa || 0 : null;

    return {
      inv,
      aportesEfetivos,
      tipoTributacao,
      idxMap,
      pIndexador,
      taxaFixaAnual,
    };
  });

  // Cache de fronteira: valEnd do mês M (em nextStartStr) é reutilizado como valStart do mês M+1 (em startStr)
  // Reduz pela metade as chamadas a calcularRendimentoComCDI com resultado 100% idêntico.
  const boundaryValueCache = new Map<string, number>();
  const getCachedValorAtual = (
    cacheKey: string,
    params: Parameters<typeof calcularRendimentoComCDI>[0]
  ): number => {
    const cached = boundaryValueCache.get(cacheKey);
    if (cached !== undefined) return cached;
    const val = calcularRendimentoComCDI(params).valorAtual;
    boundaryValueCache.set(cacheKey, val);
    return val;
  };

  const allPortfolioMonthly: (number | null)[] = months.map((m) => {
    let totalYieldInMonth = 0;
    let totalWeightedCapital = 0;

    for (const item of preparedInvestments) {
      const { inv, aportesEfetivos, tipoTributacao, idxMap, pIndexador, taxaFixaAnual } = item;
      const invResgateFallbackDate =
        inv.status === "resgatado" && inv.data_resgate ? inv.data_resgate.split("T")[0] : null;

      for (const aporte of aportesEfetivos) {
        const aporteDateStr = aporte.data_aporte.split("T")[0];
        // Lote ainda não existia neste mês (ou ainda não existia até effectiveEndStr)
        if (aporteDateStr >= m.effectiveEndStr) continue;

        const valorOriginal = roundCurrency(Number(aporte.valor_original));
        if (!Number.isFinite(valorOriginal) || valorOriginal <= 0.009) continue;

        // Resgates associados a este lote (O(1))
        const alocacoesLote = alocacoesByAporteId.get(aporte.id) || [];

        let consumedBeforeMonth = 0;
        const redemptionsDuringMonth: { principal: number; date: string }[] = [];

        if (alocacoesLote.length > 0) {
          for (const aloc of alocacoesLote) {
            const resgDate = resgateDateMap.get(aloc.resgate_id) || invResgateFallbackDate;
            const principalConsumed = roundCurrency(Number(aloc.principal_consumido));
            if (principalConsumed <= 0) continue;

            if (resgDate && resgDate < m.startStr) {
              consumedBeforeMonth = roundCurrency(consumedBeforeMonth + principalConsumed);
            } else if (resgDate && resgDate >= m.startStr && resgDate < m.effectiveEndStr) {
              redemptionsDuringMonth.push({ principal: principalConsumed, date: resgDate });
            }
          }
        } else if (invResgateFallbackDate) {
          // Investimento legado marcado como resgatado sem linhas em investimentos_resgates_aportes
          if (invResgateFallbackDate < m.startStr) {
            consumedBeforeMonth = valorOriginal;
          } else if (invResgateFallbackDate >= m.startStr && invResgateFallbackDate < m.effectiveEndStr) {
            redemptionsDuringMonth.push({ principal: valorOriginal, date: invResgateFallbackDate });
          }
        }

        const principalAtStart = roundCurrency(Math.max(0, valorOriginal - consumedBeforeMonth));
        if (principalAtStart <= 0.009) continue;

        const redeemedInMonthSum = roundCurrency(
          redemptionsDuringMonth.reduce((sum, r) => sum + r.principal, 0)
        );
        const principalHeldToEnd = roundCurrency(Math.max(0, principalAtStart - redeemedInMonthSum));

        // 1. Parcela do lote que permaneceu ativa até o final do período do mês
        if (principalHeldToEnd > 0.009) {
          if (aporteDateStr < m.startStr) {
            const valStart = getCachedValorAtual(
              `${aporte.id}|${principalHeldToEnd}|${m.startStr}`,
              {
                valorInicial: principalHeldToEnd,
                dataInicio: aporteDateStr,
                dataFim: m.startStr,
                dataVencimento: inv.data_vencimento || null,
                indexadorMap: idxMap,
                indexador: inv.indexador ?? "CDI",
                percentualIndexador: pIndexador,
                taxaFixaAnual,
                tipoTributacao,
              }
            );

            const valEnd = getCachedValorAtual(
              `${aporte.id}|${principalHeldToEnd}|${m.effectiveEndStr}`,
              {
                valorInicial: principalHeldToEnd,
                dataInicio: aporteDateStr,
                dataFim: m.effectiveEndStr,
                dataVencimento: inv.data_vencimento || null,
                indexadorMap: idxMap,
                indexador: inv.indexador ?? "CDI",
                percentualIndexador: pIndexador,
                taxaFixaAnual,
                tipoTributacao,
              }
            );

            totalYieldInMonth += valEnd - valStart;
            totalWeightedCapital += valStart;
          } else {
            // Aporte realizado durante o mês M (ponderação Modified Dietz pelos dias ativos no mês)
            const valEnd = getCachedValorAtual(
              `${aporte.id}|${principalHeldToEnd}|${m.effectiveEndStr}`,
              {
                valorInicial: principalHeldToEnd,
                dataInicio: aporteDateStr,
                dataFim: m.effectiveEndStr,
                dataVencimento: inv.data_vencimento || null,
                indexadorMap: idxMap,
                indexador: inv.indexador ?? "CDI",
                percentualIndexador: pIndexador,
                taxaFixaAnual,
                tipoTributacao,
              }
            );

            const dayOfAporte = Number(aporteDateStr.split("-")[2]) || 1;
            const activeDays = Math.max(1, m.effectiveDaysInMonth - dayOfAporte + 1);
            const weight = activeDays / m.effectiveDaysInMonth;

            totalYieldInMonth += valEnd - principalHeldToEnd;
            totalWeightedCapital += principalHeldToEnd * weight;
          }
        }

        // 2. Parcelas resgatadas durante o mês M
        for (const red of redemptionsDuringMonth) {
          if (red.principal <= 0.009) continue;
          const dayOfRedemption = Number(red.date.split("-")[2]) || 1;

          if (aporteDateStr < m.startStr) {
            const valStart = getCachedValorAtual(
              `${aporte.id}|${red.principal}|${m.startStr}`,
              {
                valorInicial: red.principal,
                dataInicio: aporteDateStr,
                dataFim: m.startStr,
                dataVencimento: inv.data_vencimento || null,
                indexadorMap: idxMap,
                indexador: inv.indexador ?? "CDI",
                percentualIndexador: pIndexador,
                taxaFixaAnual,
                tipoTributacao,
              }
            );

            const valAtRedemption = getCachedValorAtual(
              `${aporte.id}|${red.principal}|${red.date}`,
              {
                valorInicial: red.principal,
                dataInicio: aporteDateStr,
                dataFim: red.date,
                dataVencimento: inv.data_vencimento || null,
                indexadorMap: idxMap,
                indexador: inv.indexador ?? "CDI",
                percentualIndexador: pIndexador,
                taxaFixaAnual,
                tipoTributacao,
              }
            );

            const weight = Math.max(1, dayOfRedemption) / m.effectiveDaysInMonth;
            totalYieldInMonth += valAtRedemption - valStart;
            totalWeightedCapital += valStart * weight;
          } else {
            const valAtRedemption = getCachedValorAtual(
              `${aporte.id}|${red.principal}|${red.date}`,
              {
                valorInicial: red.principal,
                dataInicio: aporteDateStr,
                dataFim: red.date,
                dataVencimento: inv.data_vencimento || null,
                indexadorMap: idxMap,
                indexador: inv.indexador ?? "CDI",
                percentualIndexador: pIndexador,
                taxaFixaAnual,
                tipoTributacao,
              }
            );

            const dayOfAporte = Number(aporteDateStr.split("-")[2]) || 1;
            const activeDays = Math.max(1, dayOfRedemption - dayOfAporte + 1);
            const weight = activeDays / m.effectiveDaysInMonth;

            totalYieldInMonth += valAtRedemption - red.principal;
            totalWeightedCapital += red.principal * weight;
          }
        }
      }
    }

    const portfolioVal =
      totalWeightedCapital > 0.01 && Number.isFinite(totalYieldInMonth)
        ? (totalYieldInMonth / totalWeightedCapital) * 100
        : null;

    return portfolioVal !== null && Number.isFinite(portfolioVal)
      ? Number(portfolioVal.toFixed(4))
      : null;
  });

  // Monta os 12 pontos visíveis do gráfico com seus respectivos acumulados compostos de 12 meses
  const points: MonthlyEvolutionPoint[] = [];
  for (let idx = LOOKBACK_MONTHS; idx < months.length; idx++) {
    const m = months[idx];
    const ipcaVal = ipcaMap.has(m.key) ? ipcaMap.get(m.key)! : null;
    const cdiVal = cdiMap.has(m.key) ? cdiMap.get(m.key)! : null;
    const portfolioVal = allPortfolioMonthly[idx];

    const ipca12m = compute12MFromMonthlyMap(ipcaMap, m.date, currentMonthKey, true);
    const cdi12m = compute12MFromMonthlyMap(cdiMap, m.date, currentMonthKey, false);
    const cdiAnnualRate = resolveCdiAnnualRateForMonth(cdiAnnualMap, m.key, currentMonthKey);
    const portfolio12m = compound12Months(
      allPortfolioMonthly.slice(idx - 11, idx + 1)
    );

    points.push({
      key: m.key,
      label: m.label,
      fullLabel: m.fullLabel,
      isPartial: m.isPartial,
      ipca: ipcaVal !== null && Number.isFinite(ipcaVal) ? Number(ipcaVal.toFixed(4)) : null,
      cdi: cdiVal !== null && Number.isFinite(cdiVal) ? Number(cdiVal.toFixed(4)) : null,
      portfolio: portfolioVal,
      ipca12m,
      cdi12m,
      cdiAnnualRate,
      portfolio12m,
    });
  }

  const findLatest = (getter: (p: MonthlyEvolutionPoint) => number | null): number | null => {
    for (let i = points.length - 1; i >= 0; i--) {
      const val = getter(points[i]);
      if (val !== null && Number.isFinite(val)) return val;
    }
    return null;
  };

  return {
    points,
    latest: {
      ipca: findLatest((p) => p.ipca),
      cdi: findLatest((p) => p.cdi),
      portfolio: findLatest((p) => p.portfolio),
    },
    hasPortfolioHistory: points.some((p) => p.portfolio !== null),
  };
}
