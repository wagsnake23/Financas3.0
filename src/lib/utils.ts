import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from "date-fns-tz"; // Removido zonedTimeToUtc
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

// 🔥 Correção aplicada aqui
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
    // Default focus state for fields without validation status
    borderClass = "focus:border-[#A8C5FF] focus:ring-[#A8C5FF]/10";
  }

  return cn(
    borderClass,
    "focus-visible:ring-4 focus-visible:outline-none transition-all duration-200",
    "focus:ring-4 focus:outline-none"
  );
};

export const TARGET_TIMEZONE = "America/Sao_Paulo"; // Fuso horário UTC-3 (Brasília)
export { formatInTimeZone }; // Exportar apenas formatInTimeZone

// Função de fallback para zonedTimeToUtc
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
  data_fim: string | null;
}

export function buildIndexadorMap(indexadores: IndexadorHistorico[]): Map<string, number> {
  const map = new Map<string, number>();
  if (indexadores.length === 0) return map;

  // Assume indexadores are ordered by data_inicio ascending
  const firstStartStr = indexadores[0].data_inicio.includes('T') ? indexadores[0].data_inicio.split('T')[0] : indexadores[0].data_inicio;
  const firstDate = new Date(`${firstStartStr}T00:00:00`);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let ultimaTaxaConhecida = 0;
  let index = 0;

  for (let d = new Date(firstDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dataStr = d.toISOString().split("T")[0];

    // Catch up any indexers that started on or before this date
    while (index < indexadores.length) {
      const idxStartStr = indexadores[index].data_inicio.includes('T') ? indexadores[index].data_inicio.split('T')[0] : indexadores[index].data_inicio;
      if (idxStartStr <= dataStr) {
        if (indexadores[index].taxa_diaria != null) {
          ultimaTaxaConhecida = indexadores[index].taxa_diaria;
        }
        index++;
      } else {
        break;
      }
    }

    if (ultimaTaxaConhecida > 0) {
      map.set(dataStr, ultimaTaxaConhecida);
    }
  }

  return map;
}

export function calcularRendimentoComCDI({
  valorInicial,
  dataInicio,
  dataFim,
  indexadorMap,
  percentualIndexador = 100,
  taxaAdicionalAoAno = 0
}: {
  valorInicial: number;
  dataInicio: Date | string;
  dataFim: Date | string;
  indexadorMap: Map<string, number>;
  percentualIndexador?: number;
  taxaAdicionalAoAno?: number;
}): { valorAtual: number; ultimaTaxaAplicada: number } {
  let valor = valorInicial;
  
  // Safe date conversion handling timezone offsets by slicing out the time if it's a string
  let dStart = typeof dataInicio === 'string' ? dataInicio.split('T')[0] : dataInicio.toISOString().split('T')[0];
  const inicio = new Date(`${dStart}T00:00:00`);
  
  let dEnd = typeof dataFim === 'string' ? dataFim.split('T')[0] : dataFim.toISOString().split('T')[0];
  const fim = new Date(`${dEnd}T00:00:00`);

  const taxaDiariaAdicional = taxaAdicionalAoAno > 0 ? Math.pow(1 + taxaAdicionalAoAno / 100, 1 / 252) - 1 : 0;
  
  let ultimaTaxaAplicada = 0;

  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    const taxaDia = indexadorMap.get(key);

    let taxaNesseDia = taxaDiariaAdicional;

    if (taxaDia) {
      // CDI é contínuo, aplicamos o percentual em cima da taxa diária real do mapa (que é fornecida em %)
      taxaNesseDia += (taxaDia / 100) * (percentualIndexador / 100);
    }
    
    if (taxaNesseDia > 0) {
      valor *= 1 + taxaNesseDia;
      ultimaTaxaAplicada = taxaNesseDia;
    }
  }

  return { valorAtual: valor, ultimaTaxaAplicada };
}

