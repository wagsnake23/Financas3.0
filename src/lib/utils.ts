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
 * Normaliza uma data para o formato YYYY-MM-DD.
 */
function formatDateKey(date: Date | string): string {
  if (typeof date === 'string') {
    return date.split('T')[0];
  }
  return date.toISOString().split('T')[0];
}

export function buildIndexadorMap(indexadores: IndexadorHistorico[]): Map<string, number> {
  const map = new Map<string, number>();

  if (!indexadores || indexadores.length === 0) return map;

  // Processar apenas taxa_diaria, ignorando taxa_anual conforme solicitado
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
}: {
  valorInicial: number;
  dataInicio: string | Date;
  indexadorMap: Map<string, number>;
  percentualIndexador?: number;
}): { valorAtual: number; ultimaTaxaAplicada: number } {
  let valor = valorInicial;

  const startStr = formatDateKey(dataInicio);
  const inicio = new Date(`${startStr}T00:00:00`);
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let ultimaTaxa = 0;
  let ultimaTaxaAplicada = 0;

  const primeiroDiaYield = new Date(inicio);
  primeiroDiaYield.setDate(primeiroDiaYield.getDate() + 1);

  // Busca de semente retroativa (até 2 anos)
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

  // Loop principal
  for (let d = new Date(primeiroDiaYield); d <= hoje; d.setDate(d.getDate() + 1)) {
    const key = formatDateKey(d);
    const taxaDia = indexadorMap.get(key);

    if (taxaDia !== undefined && taxaDia !== null && taxaDia > 0) {
      const taxa = taxaDia * (percentualIndexador / 100);
      valor *= (1 + taxa);
      ultimaTaxa = taxaDia;
      ultimaTaxaAplicada = taxa;
    } else if (ultimaTaxa > 0) {
      const taxa = ultimaTaxa * (percentualIndexador / 100);
      valor *= (1 + taxa);
      ultimaTaxaAplicada = taxa;
    }
  }

  return { valorAtual: valor, ultimaTaxaAplicada };
}
