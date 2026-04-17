import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from "date-fns-tz";
import { AppCategory, Investment } from "@/types/finance";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isValidUuid = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

export const formatCurrency = (value?: number | null, showSymbol: boolean = true) => {
  if (typeof value !== "number" || isNaN(value)) {
    return showSymbol ? "R$ 0,00" : "0,00";
  }

  if (!showSymbol) {
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

interface GetBorderClassProps {
  isValid?: boolean;
  isInvalid?: boolean;
}

export const getBorderClass = ({
  isValid,
  isInvalid,
}: GetBorderClassProps): string => {
  let borderClass = "";
  if (isInvalid) {
    borderClass = "border-destructive focus:border-destructive focus:ring-destructive/10";
  } else if (isValid) {
    borderClass = "border-[#A8C5FF] focus:border-[#A8C5FF] focus:ring-[#A8C5FF]/10";
  } else {
    borderClass = "focus:border-[#A8C5FF] focus:ring-[#A8C5FF]/10";
  }

  return cn(
    borderClass,
    "focus-visible:ring-4 focus-visible:outline-none transition-all duration-200",
    "focus:ring-4 focus:outline-none"
  );
};

export const TARGET_TIMEZONE = "America/Sao_Paulo";
export { formatInTimeZone };

export function zonedTimeToUtcFallback(
  dateString: string,
  timeZone: string
): Date {
  return new Date(new Date(dateString).toLocaleString("en-US", { timeZone }));
}

export type TipoTributacao = "regressivo" | "isento";

export function getAliquotaIR(
  dataInvestimento: Date,
  tipoTributacao: TipoTributacao = "regressivo"
): number {
  if (tipoTributacao === "isento") return 0;

  const hoje = new Date();
  const diffTime = Math.abs(hoje.getTime() - dataInvestimento.getTime());
  const diffDias = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDias <= 180) return 22.5;
  if (diffDias <= 360) return 20;
  if (diffDias <= 720) return 17.5;
  return 15;
}

export function getTipoTributacao(
  inv: Investment | { nome: string },
  categorias: AppCategory[]
): TipoTributacao {
  const categoria = categorias.find(c => c.id === inv.nome);
  return categoria?.tipo_tributacao ?? "regressivo";
}

export interface IndexadorHistorico {
  id?: string;
  tipo: string;
  taxa_anual: number;
  taxa_diaria: number;
  data_inicio: string;
}

/**
 * Normaliza uma data para o formato YYYY-MM-DD usando o fuso horário de Brasília.
 */
function formatDateKey(date: Date | string): string {
  if (typeof date === 'string') {
    return date.split('T')[0];
  }

  return date.toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Verifica se uma data é dia útil (segunda a sexta).
 */
export function isDiaUtil(date: Date): boolean {
  const diaSemana = date.getDay();
  if (diaSemana === 0 || diaSemana === 6) {
    return false;
  }
  return true;
}

export function buildIndexadorMap(indexadores: IndexadorHistorico[]): Map<string, number> {
  const map = new Map<string, number>();

  if (!indexadores || indexadores.length === 0) return map;

  for (const item of indexadores) {
    if (!item.data_inicio || item.taxa_diaria == null) continue;
    const key = item.data_inicio.split('T')[0];
    map.set(key, Number(item.taxa_diaria));
  }

  return map;
}

export function calcularRendimentoComCDI({
  valorInicial,
  dataInicio,
  indexadorMap,
  percentualIndexador = 100,
  taxaFixaAnual = null,
}: {
  valorInicial: number;
  dataInicio: string | Date;
  indexadorMap: Map<string, number>;
  percentualIndexador?: number;
  taxaFixaAnual?: number | null;
}): { valorAtual: number; ultimaTaxaAplicada: number } {
  let valor = valorInicial;

  const startStr = formatDateKey(dataInicio);
  const inicio = new Date(startStr + "T12:00:00");
  
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);

  let ultimaTaxa = 0;
  let ultimaTaxaAplicada = 0;

  const primeiroDiaYield = new Date(inicio);
  primeiroDiaYield.setDate(primeiroDiaYield.getDate() + 1);

  // Busca de semente retroativa para indexadores (até 2 anos)
  if (indexadorMap.size > 0) {
    let dataSemente = new Date(inicio);
    for (let i = 0; i < 730; i++) {
      const key = formatDateKey(dataSemente);
      const taxaSemente = indexadorMap.get(key);
      if (taxaSemente !== undefined && taxaSemente !== null) {
        ultimaTaxa = taxaSemente;
        break;
      }
      dataSemente.setDate(dataSemente.getDate() - 1);
    }
  }

  const taxaDiariaFixa = taxaFixaAnual !== null ? (Math.pow(1 + taxaFixaAnual / 100, 1 / 252) - 1) : 0;

  // Loop principal
  for (let d = new Date(primeiroDiaYield); d <= hoje; d.setDate(d.getDate() + 1)) {
    if (!isDiaUtil(d)) continue;

    const key = formatDateKey(d);
    
    if (taxaFixaAnual !== null) {
      // Caso Renda Fixa Prefixada
      valor *= (1 + taxaDiariaFixa);
      ultimaTaxaAplicada = taxaDiariaFixa;
    } else {
      // Caso Renda Fixa Pós-fixada (CDI/IPCA)
      const taxaDia = indexadorMap.get(key);
      const isHoje = formatDateKey(d) === formatDateKey(hoje);

      let taxaBase: number | undefined = undefined;

      if (taxaDia !== undefined && taxaDia !== null && taxaDia > 0) {
        taxaBase = taxaDia;
      } else if (isHoje && ultimaTaxa > 0) {
        // 🔥 CORREÇÃO: Se for hoje e não houver taxa no mapa, usa a última taxa válida como estimativa.
        // Isso permite visualizar o rendimento do dia antes da publicação oficial.
        taxaBase = ultimaTaxa;
      }

      if (taxaBase !== undefined && taxaBase > 0) {
        const taxa = taxaBase * (percentualIndexador / 100);
        valor *= (1 + taxa);
        ultimaTaxa = taxaBase;
        ultimaTaxaAplicada = taxa;
      }
    }
  }

  return { valorAtual: valor, ultimaTaxaAplicada };
}
