import React, { memo, startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Card } from "@/components/ui/card";
import { MonthNavigatorCompact } from "@/components/MonthNavigatorCompact";
import { cn, IndexadorHistorico } from "@/lib/utils";
import {
  AppCategory,
  Investment,
  InvestmentContribution,
  InvestmentRedemption,
  InvestmentRedemptionAllocation,
} from "@/types/finance";
import {
  buildMonthlyEvolutionData,
  getCurrentMonthKey,
  MonthlyEvolutionPoint,
  resolveEvolutionWindowEndKey,
} from "@/lib/monthlyEvolution";

interface MonthlyEvolutionCardProps {
  indexadores: IndexadorHistorico[];
  investments: Investment[];
  aportes: InvestmentContribution[];
  alocacoes: InvestmentRedemptionAllocation[];
  resgates: InvestmentRedemption[];
  allSubcategories: AppCategory[];
  indexadorMapCDI: Map<string, number>;
  indexadorMapIPCA: Map<string, number>;
  selectedMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectMonth?: (date: Date) => void;
  isLoading?: boolean;
  isMobile?: boolean;
}

const COLORS = {
  ipca: "#DC2626",
  cdi: "#2563EB",
  portfolio: "#16A34A",
} as const;

const CHART_MARGIN_MOBILE = { top: 6, right: 6, left: 6, bottom: 0 };
const CHART_MARGIN_DESKTOP = { top: 12, right: 20, left: 6, bottom: 6 };
const Y_TICK_MOBILE = { fill: "#94A3B8", fontSize: 10.5, fontWeight: 600 };
const Y_TICK_DESKTOP = { fill: "#94A3B8", fontSize: 11, fontWeight: 600 };
const TOOLTIP_CURSOR = { stroke: "rgba(148, 163, 184, 0.35)", strokeWidth: 1, strokeDasharray: "3 3" };

const EMPTY_RESULT = {
  points: [] as MonthlyEvolutionPoint[],
  latest: { ipca: null, cdi: null, portfolio: null },
  hasPortfolioHistory: false,
};

function formatPercentPTBR(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function formatYAxisTick(val: number): string {
  return `${Number(val).toFixed(1).replace(".", ",")}%`;
}

function dateFromMonthKey(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1, 12, 0, 0);
}

const MonthlyEvolutionTooltip: React.FC<{ active?: boolean; payload?: any[] }> = ({
  active,
  payload,
}) => {
  if (!active || !payload || !payload.length) return null;
  const point: MonthlyEvolutionPoint | undefined = payload[0]?.payload;
  if (!point) return null;

  const rows = [
    { label: "IPCA", value: point.ipca, color: COLORS.ipca },
    { label: "CDI", value: point.cdi, color: COLORS.cdi },
    { label: "Meus investimentos", value: point.portfolio, color: COLORS.portfolio },
  ];

  return (
    <div
      className="rounded-2xl px-3.5 py-2.5 text-xs shadow-lg border border-slate-200/80"
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.96)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="font-extrabold text-slate-800 text-[12px] tracking-tight">
          {point.fullLabel}
        </p>
        {point.isPartial && (
          <span className="text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100/90 text-amber-700 leading-none">
            Parcial
          </span>
        )}
      </div>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: row.color }}
              />
              <span className="font-semibold text-slate-600">{row.label}</span>
            </div>
            <span
              className="font-bold tabular-nums"
              style={{ color: row.value !== null ? row.color : "#94A3B8" }}
            >
              {row.value !== null ? formatPercentPTBR(row.value) : "Sem dados"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const MonthlyEvolutionCardComponent: React.FC<MonthlyEvolutionCardProps> = ({
  indexadores,
  investments,
  aportes,
  alocacoes,
  resgates,
  allSubcategories,
  indexadorMapCDI,
  indexadorMapIPCA,
  selectedMonth,
  onPreviousMonth,
  onNextMonth,
  onSelectMonth,
  isLoading = false,
  isMobile = false,
}) => {
  // Adia o cálculo pesado e a montagem do SVG para após o primeiro paint dos cards principais do Dashboard
  const [isChartReady, setIsChartReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      startTransition(() => {
        setIsChartReady(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Chave de competência YYYY-MM do mês selecionado, limite dinâmico atual e fim estável da janela de 12 meses
  const selectedMonthKey = format(selectedMonth, "yyyy-MM");
  const currentMonthKey = getCurrentMonthKey();
  const windowEndKey = useMemo(
    () => resolveEvolutionWindowEndKey(selectedMonth),
    [selectedMonthKey]
  );

  // Só recalcula os 12 meses quando os dados mudam ou quando o usuário navega para fora da janela atual
  const { points, hasPortfolioHistory } = useMemo(() => {
    if (!isChartReady || isLoading) return EMPTY_RESULT;
    return buildMonthlyEvolutionData({
      indexadores,
      investments,
      aportes,
      alocacoes,
      resgates,
      allSubcategories,
      indexadorMapCDI,
      indexadorMapIPCA,
      windowEndKey,
    });
  }, [
    isChartReady,
    isLoading,
    indexadores,
    investments,
    aportes,
    alocacoes,
    resgates,
    allSubcategories,
    indexadorMapCDI,
    indexadorMapIPCA,
    windowEndKey,
  ]);

  // Limite máximo navegável pelo seletor do card: nunca avançar para competências futuras
  const maxNavigableKey = useMemo(() => {
    if (points.length > 0) {
      const lastPointKey = points[points.length - 1].key;
      return lastPointKey < currentMonthKey ? lastPointKey : currentMonthKey;
    }
    return currentMonthKey;
  }, [points, currentMonthKey]);

  const handleSafeNextMonth = useCallback(() => {
    if (selectedMonthKey >= maxNavigableKey) return;
    onNextMonth();
  }, [selectedMonthKey, maxNavigableKey, onNextMonth]);

  // Competência exatamente sincronizada por chave YYYY-MM (sem índices fixos e sem fallback silencioso)
  const selectedPoint = useMemo(() => {
    return points.find((p) => p.key === selectedMonthKey) || null;
  }, [points, selectedMonthKey]);

  // Escala vertical compartilhada pelas 3 séries, suportando valores negativos do IPCA
  const { yDomain } = useMemo(() => {
    const allValues: number[] = [];
    for (const p of points) {
      if (p.ipca !== null) allValues.push(p.ipca);
      if (p.cdi !== null) allValues.push(p.cdi);
      if (p.portfolio !== null) allValues.push(p.portfolio);
    }

    if (allValues.length === 0) {
      return { yDomain: [0, 1.5] as [number, number], hasNegative: false };
    }

    const rawMin = Math.min(...allValues);
    const rawMax = Math.max(...allValues);
    const span = Math.max(0.4, rawMax - rawMin);
    const pad = span * 0.16;

    const minVal =
      rawMin < 0
        ? Math.floor((rawMin - pad) * 10) / 10
        : Math.max(0, Math.floor((rawMin - pad) * 10) / 10);
    const maxVal = Math.ceil((rawMax + pad) * 10) / 10;

    return {
      yDomain: [minVal, maxVal === minVal ? minVal + 1 : maxVal] as [number, number],
      hasNegative: rawMin < 0,
    };
  }, [points]);

  const hasAnySeriesData = useMemo(() => {
    return points.some((p) => p.ipca !== null || p.cdi !== null || p.portfolio !== null);
  }, [points]);

  // Último IPCA publicado até a competência selecionada (exibido com identificação da competência quando o mês atual ainda não foi divulgado)
  const latestPublishedIpca = useMemo(() => {
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      if (p.key <= selectedMonthKey && p.ipca !== null && Number.isFinite(p.ipca)) {
        return p;
      }
    }
    return null;
  }, [points, selectedMonthKey]);

  const indicators = useMemo(() => {
    const ipcaFromSelected = selectedPoint ? selectedPoint.ipca : null;
    const isIpcaFallback = ipcaFromSelected === null && latestPublishedIpca !== null;

    return [
      {
        key: "ipca",
        label: "IPCA",
        fullLabel: isIpcaFallback
          ? `IPCA (último publicado: ${latestPublishedIpca.fullLabel.toUpperCase()})`
          : "IPCA",
        value: isIpcaFallback ? latestPublishedIpca.ipca : ipcaFromSelected,
        subMetricValue: formatPercentPTBR(selectedPoint ? selectedPoint.ipca12m : null),
        subMetricUnit: isMobile ? "12M" : "(12 meses)",
        subLabel: isIpcaFallback ? latestPublishedIpca.fullLabel.toUpperCase() : null,
        color: COLORS.ipca,
        bg: "rgba(220, 38, 38, 0.065)",
      },
      {
        key: "cdi",
        label: "CDI",
        fullLabel: "CDI",
        value: selectedPoint ? selectedPoint.cdi : null,
        subMetricValue: formatPercentPTBR(selectedPoint ? selectedPoint.cdiAnnualRate : null),
        subMetricUnit: "a.a.",
        subLabel: null,
        color: COLORS.cdi,
        bg: "rgba(37, 99, 235, 0.065)",
      },
      {
        key: "portfolio",
        label: isMobile ? "Carteira" : "Meus investimentos",
        fullLabel: "Meus investimentos",
        value: selectedPoint ? selectedPoint.portfolio : null,
        subMetricValue: formatPercentPTBR(selectedPoint ? selectedPoint.portfolio12m : null),
        subMetricUnit: "a.a.",
        subLabel: null,
        color: COLORS.portfolio,
        bg: "rgba(22, 163, 74, 0.065)",
      },
    ];
  }, [selectedPoint, latestPublishedIpca, isMobile]);

  // Renderizador de pontos com bolinha branca de seleção sincronizada ao mês selecionado.
  // IMPORTANTE: No Recharts <Area>, props.value é um array [baseValue, dataValue] (ex: [0, null]),
  // portanto validamos diretamente payload[seriesKey] para nunca desenhar pontos quando o valor é null.
  const createDotRenderer = useCallback(
    (seriesKey: "ipca" | "cdi" | "portfolio", color: string) => {
      return (props: any) => {
        const { cx, cy, payload } = props;
        const rawVal = payload?.[seriesKey];
        if (
          rawVal === null ||
          rawVal === undefined ||
          !Number.isFinite(rawVal) ||
          typeof cx !== "number" ||
          typeof cy !== "number" ||
          !Number.isFinite(cx) ||
          !Number.isFinite(cy) ||
          !payload?.key
        ) {
          return null;
        }

        const isSelected = payload.key === selectedMonthKey;
        const handleClick = onSelectMonth
          ? (e: React.MouseEvent) => {
              e.stopPropagation();
              onSelectMonth(dateFromMonthKey(payload.key));
            }
          : undefined;

        if (isSelected) {
          return (
            <g
              key={`sel-${seriesKey}-${payload.key}`}
              onClick={handleClick}
              style={{ cursor: onSelectMonth ? "pointer" : "default" }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={isMobile ? 7.5 : 8.5}
                fill={color}
                fillOpacity={0.18}
              />
              <circle
                cx={cx}
                cy={cy}
                r={isMobile ? 4.5 : 5.2}
                fill="#FFFFFF"
                stroke={color}
                strokeWidth={2.4}
              />
            </g>
          );
        }

        return (
          <circle
            key={`dot-${seriesKey}-${payload.key}`}
            cx={cx}
            cy={cy}
            r={isMobile ? 3.2 : 3.8}
            fill={color}
            stroke="#FFFFFF"
            strokeWidth={1.6}
            onClick={handleClick}
            style={{ cursor: onSelectMonth ? "pointer" : "default" }}
          />
        );
      };
    },
    [selectedMonthKey, isMobile, onSelectMonth]
  );

  // Guard para activeDot: nunca renderizar marcador quando a série não tem valor na competência
  const createActiveDotRenderer = useCallback(
    (seriesKey: "ipca" | "cdi" | "portfolio", color: string) => {
      return (props: any) => {
        const { cx, cy, payload } = props;
        const rawVal = payload?.[seriesKey];
        if (
          rawVal === null ||
          rawVal === undefined ||
          !Number.isFinite(rawVal) ||
          typeof cx !== "number" ||
          typeof cy !== "number" ||
          !Number.isFinite(cx) ||
          !Number.isFinite(cy)
        ) {
          return null;
        }
        return (
          <circle
            cx={cx}
            cy={cy}
            r={5.5}
            fill={color}
            stroke="#FFFFFF"
            strokeWidth={2}
          />
        );
      };
    },
    []
  );

  const renderIpcaDot = useMemo(
    () => createDotRenderer("ipca", COLORS.ipca),
    [createDotRenderer]
  );
  const renderCdiDot = useMemo(
    () => createDotRenderer("cdi", COLORS.cdi),
    [createDotRenderer]
  );
  const renderPortfolioDot = useMemo(
    () => createDotRenderer("portfolio", COLORS.portfolio),
    [createDotRenderer]
  );

  const renderIpcaActiveDot = useMemo(
    () => createActiveDotRenderer("ipca", COLORS.ipca),
    [createActiveDotRenderer]
  );
  const renderCdiActiveDot = useMemo(
    () => createActiveDotRenderer("cdi", COLORS.cdi),
    [createActiveDotRenderer]
  );
  const renderPortfolioActiveDot = useMemo(
    () => createActiveDotRenderer("portfolio", COLORS.portfolio),
    [createActiveDotRenderer]
  );

  const handleChartClick = useCallback(
    (state: any) => {
      if (!onSelectMonth) return;
      const clickedKey: string | undefined =
        state?.activePayload?.[0]?.payload?.key ??
        (typeof state?.activeTooltipIndex === "number"
          ? points[state.activeTooltipIndex]?.key
          : undefined);
      if (clickedKey && clickedKey !== selectedMonthKey) {
        onSelectMonth(dateFromMonthKey(clickedKey));
      }
    },
    [onSelectMonth, selectedMonthKey, points]
  );

  // Tick customizado do eixo X destacando o mês selecionado no mesmo padrão visual do badge PARCIAL
  const renderXAxisTick = useCallback(
    (props: any) => {
      const { x, y, payload, index } = props;
      const point = typeof index === "number" ? points[index] : points.find((p) => p.label === payload?.value);
      const isSelected = Boolean(point && point.key === selectedMonthKey);
      const labelText = point?.label ?? payload?.value ?? "";
      const fontSize = isMobile ? 10 : 11.5;

      const handleTickClick =
        onSelectMonth && point?.key
          ? (e: React.MouseEvent) => {
              e.stopPropagation();
              if (point.key !== selectedMonthKey) {
                onSelectMonth(dateFromMonthKey(point.key));
              }
            }
          : undefined;

      if (isSelected) {
        const pillW = isMobile ? 28 : 36;
        const pillH = isMobile ? 16 : 20;
        const pillY = isMobile ? 0 : 5;
        return (
          <g
            transform={`translate(${x},${y})`}
            onClick={handleTickClick}
            style={{ cursor: onSelectMonth ? "pointer" : "default" }}
          >
            <rect
              x={-pillW / 2}
              y={pillY}
              width={pillW}
              height={pillH}
              rx={pillH / 2}
              fill="rgba(254, 243, 199, 0.95)"
            />
            <text
              x={0}
              y={pillY + pillH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#B45309"
              fontSize={fontSize}
              fontWeight={600}
            >
              {labelText}
            </text>
          </g>
        );
      }

      return (
        <g
          transform={`translate(${x},${y})`}
          onClick={handleTickClick}
          style={{ cursor: onSelectMonth ? "pointer" : "default" }}
        >
          <text
            x={0}
            y={isMobile ? 8 : 15}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#64748B"
            fontSize={fontSize}
            fontWeight={600}
          >
            {labelText}
          </text>
        </g>
      );
    },
    [points, selectedMonthKey, isMobile, onSelectMonth]
  );

  const showLoading = isLoading || !isChartReady;

  return (
    <Card
      className={cn(
        "w-full overflow-hidden flex flex-col relative",
        isMobile ? "rounded-[21px] px-4 pt-4 pb-3 h-[330px]" : "border-none rounded-[32px] p-8"
      )}
      style={{
        background:
          "linear-gradient(135deg, rgba(250, 251, 255, 0.94) 0%, rgba(255, 255, 255, 0.92) 55%, rgba(244, 247, 255, 0.94) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.85)",
        backgroundClip: "padding-box",
        boxShadow:
          "0 8px 24px rgba(15, 23, 42, 0.06), 0 2px 6px rgba(15, 23, 42, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(18px) saturate(1.4)",
        WebkitBackdropFilter: "blur(18px) saturate(1.4)",
      }}
    >
      {/* Brilho sutil de superfície */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-20px",
          right: "-30px",
          width: "40%",
          height: "35%",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.28)",
          filter: "blur(4px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div className="relative z-10 flex flex-col w-full h-full">
        {/* Cabeçalho com seletor de mês/ano */}
        <div className={cn("flex flex-col shrink-0", isMobile ? "mb-3.5" : "mb-5")}>
          <div className={cn("flex items-start justify-between gap-2", isMobile && "h-[46px]")}>
            <div className="flex items-start gap-2 min-w-0">
              <div className="h-7 w-1.5 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full shrink-0 mt-0.5" />
              {isMobile ? (
                <div className="flex flex-col min-w-0">
                  <h3
                    className="tracking-tight leading-tight text-slate-800 whitespace-nowrap text-[18px] font-bold pt-0.5"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    Indicadores
                  </h3>
                  <div className="h-[18px] mt-0.5 flex items-center">
                    {selectedPoint?.isPartial && (
                      <span className="w-fit text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100/90 text-amber-700 leading-none">
                        Parcial
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 min-w-0 pt-0.5">
                  <h3
                    className="tracking-tight leading-tight text-slate-800 whitespace-nowrap text-lg font-black"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    Indicador Econômico
                  </h3>
                  {selectedPoint?.isPartial && (
                    <span className="w-fit text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100/90 text-amber-700 leading-none shrink-0">
                      Parcial
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="shrink-0">
              <MonthNavigatorCompact
                premiumMode={true}
                selectedMonth={selectedMonth}
                onPreviousMonth={onPreviousMonth}
                onNextMonth={handleSafeNextMonth}
                isMobile={isMobile}
                variant="balance"
              />
            </div>
          </div>

          {/* 3 Indicadores sincronizados com a competência selecionada (% a.m.) */}
          <div
            className={cn(
              "mt-3.5",
              isMobile ? "grid grid-cols-3 gap-2" : "flex flex-wrap items-center gap-3"
            )}
          >
            {indicators.map((ind) => (
              <div
                key={ind.key}
                title={ind.fullLabel}
                className={cn(
                  "flex flex-col justify-center rounded-2xl transition-colors",
                  isMobile ? "px-2.5 py-2.5 h-[64px] gap-[2px]" : "px-3.5 py-2.5 min-w-[163px] min-h-[62px]"
                )}
                style={{
                  backgroundColor: ind.bg,
                  border: "1px solid transparent",
                }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: ind.color }}
                  />
                  <span
                    className={cn(
                      "font-semibold text-slate-600 truncate",
                      isMobile ? "text-[10.5px] leading-none" : "text-[11px]"
                    )}
                  >
                    {ind.label}
                  </span>
                </div>
                {isMobile ? (
                  <>
                    <span
                      className="font-extrabold tabular-nums tracking-tight whitespace-nowrap text-[14px] leading-[1.15]"
                      style={{ color: ind.color }}
                    >
                      {formatPercentPTBR(ind.value)}
                    </span>
                    <span className="tabular-nums whitespace-nowrap leading-none">
                      <span
                        className="font-semibold text-[10px]"
                        style={{ color: "#475569" }}
                      >
                        {ind.subMetricValue}
                      </span>
                      {ind.subMetricValue !== "--" && (
                        <span
                          className="font-medium ml-0.5 text-[9px]"
                          style={{ color: "#64748B" }}
                        >
                          {ind.subMetricUnit}
                        </span>
                      )}
                    </span>
                  </>
                ) : (
                  <div className="flex items-baseline justify-between gap-3 mt-1">
                    <span
                      className="font-extrabold tabular-nums tracking-tight whitespace-nowrap text-[15px] leading-tight"
                      style={{ color: ind.color }}
                    >
                      {formatPercentPTBR(ind.value)}
                    </span>
                    <span className="tabular-nums whitespace-nowrap leading-tight">
                      <span
                        className="font-semibold text-[11.5px]"
                        style={{ color: "#475569" }}
                      >
                        {ind.subMetricValue}
                      </span>
                      {ind.subMetricValue !== "--" && (
                        <span
                          className="font-medium ml-0.5 text-[10.5px]"
                          style={{ color: "#64748B" }}
                        >
                          {ind.subMetricUnit}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico de tendência comparativo (12 meses) */}
        {showLoading ? (
          <div
            className={cn(
              "w-full flex items-center justify-center text-slate-400 text-xs font-medium shrink-0",
              isMobile ? "h-[164px]" : "h-[285px]"
            )}
          >
            Carregando evolução mensal...
          </div>
        ) : !hasAnySeriesData ? (
          <div
            className={cn(
              "w-full flex items-center justify-center text-slate-400 text-xs font-medium text-center px-4 shrink-0",
              isMobile ? "h-[164px]" : "h-[240px]"
            )}
          >
            Ainda não há dados mensais suficientes de IPCA, CDI ou investimentos para exibir o gráfico.
          </div>
        ) : (
          <div className={cn("w-full shrink-0", isMobile ? "h-[164px] [&_svg]:overflow-visible" : "h-[285px]")}>
            <ResponsiveContainer width="100%" height={isMobile ? 164 : 285}>
              <AreaChart
                data={points}
                margin={isMobile ? CHART_MARGIN_MOBILE : CHART_MARGIN_DESKTOP}
                onClick={handleChartClick}
              >
                <defs>
                  {/* Degradês translúcidos sutis sob cada curva */}
                  <linearGradient id="evolution-grad-ipca" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.ipca} stopOpacity={0.14} />
                    <stop offset="68%" stopColor={COLORS.ipca} stopOpacity={0.03} />
                    <stop offset="100%" stopColor={COLORS.ipca} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="evolution-grad-cdi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.cdi} stopOpacity={0.14} />
                    <stop offset="68%" stopColor={COLORS.cdi} stopOpacity={0.03} />
                    <stop offset="100%" stopColor={COLORS.cdi} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="evolution-grad-portfolio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.portfolio} stopOpacity={0.15} />
                    <stop offset="68%" stopColor={COLORS.portfolio} stopOpacity={0.03} />
                    <stop offset="100%" stopColor={COLORS.portfolio} stopOpacity={0} />
                  </linearGradient>

                  {/* Profundidade suave atrás das linhas (referência card Ultravioleta) */}
                  <filter id="evolution-glow-ipca" x="-10%" y="-20%" width="120%" height="150%">
                    <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor={COLORS.ipca} floodOpacity="0.20" />
                  </filter>
                  <filter id="evolution-glow-cdi" x="-10%" y="-20%" width="120%" height="150%">
                    <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor={COLORS.cdi} floodOpacity="0.20" />
                  </filter>
                  <filter id="evolution-glow-portfolio" x="-10%" y="-20%" width="120%" height="150%">
                    <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor={COLORS.portfolio} floodOpacity="0.22" />
                  </filter>
                </defs>

                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tick={renderXAxisTick}
                  tickSize={isMobile ? 0 : 6}
                  tickMargin={isMobile ? 0 : 2}
                  height={isMobile ? 18 : 30}
                />
                <YAxis
                  hide={isMobile}
                  axisLine={false}
                  tickLine={false}
                  domain={yDomain}
                  width={isMobile ? 0 : 52}
                  tickMargin={6}
                  tick={isMobile ? Y_TICK_MOBILE : Y_TICK_DESKTOP}
                  tickFormatter={formatYAxisTick}
                />
                {selectedPoint && (
                  <ReferenceLine
                    x={selectedPoint.label}
                    stroke="rgba(148, 163, 184, 0.35)"
                    strokeDasharray="3 3"
                  />
                )}
                {!isMobile && (
                  <Tooltip content={<MonthlyEvolutionTooltip />} cursor={TOOLTIP_CURSOR} />
                )}
                <Area
                  type={isMobile ? "bumpX" : "monotone"}
                  dataKey="ipca"
                  name="IPCA"
                  baseValue={0}
                  stroke={COLORS.ipca}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="url(#evolution-grad-ipca)"
                  filter="url(#evolution-glow-ipca)"
                  dot={renderIpcaDot}
                  activeDot={isMobile ? false : renderIpcaActiveDot}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="cdi"
                  name="CDI"
                  baseValue={0}
                  stroke={COLORS.cdi}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="url(#evolution-grad-cdi)"
                  filter="url(#evolution-glow-cdi)"
                  dot={renderCdiDot}
                  activeDot={isMobile ? false : renderCdiActiveDot}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="portfolio"
                  name="Meus investimentos"
                  baseValue={0}
                  stroke={COLORS.portfolio}
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="url(#evolution-grad-portfolio)"
                  filter="url(#evolution-glow-portfolio)"
                  dot={renderPortfolioDot}
                  activeDot={isMobile ? false : renderPortfolioActiveDot}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {!showLoading && hasAnySeriesData && !hasPortfolioHistory && (
          <p className="text-[11px] text-slate-400 font-medium mt-2 text-center">
            A linha de Meus investimentos aparecerá assim que houver meses com aportes ativos.
          </p>
        )}
      </div>
    </Card>
  );
};

export const MonthlyEvolutionCard = memo(MonthlyEvolutionCardComponent);
