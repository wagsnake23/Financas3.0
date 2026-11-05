import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  variant?: "blue" | "green" | "yellow";
}

export const getBorderClass = ({
  isValid,
  isInvalid,
  variant = "blue",
}: GetBorderClassProps): string => {
  let borderClass = "";
  
  if (isInvalid) {
    borderClass = "border-destructive focus:border-destructive focus:ring-destructive/10";
  } else if (isValid) {
    if (variant === "green") borderClass = "border-[#22C55E] focus:border-[#22C55E] focus:ring-[#22C55E]/10";
    else if (variant === "yellow") borderClass = "border-[#F59E0B] focus:border-[#F59E0B] focus:ring-[#F59E0B]/10";
    else borderClass = "border-[#A8C5FF] focus:border-[#A8C5FF] focus:ring-[#A8C5FF]/10";
  } else {
    if (variant === "green") borderClass = "focus:border-[#22C55E] focus:ring-[#22C55E]/10";
    else if (variant === "yellow") borderClass = "focus:border-[#F59E0B] focus:ring-[#F59E0B]/10";
    else borderClass = "focus:border-[#A8C5FF] focus:ring-[#A8C5FF]/10";
  }

  return cn(
    borderClass,
    "focus-visible:ring-1 focus-visible:outline-none transition-all duration-200",
    "focus:ring-1 focus:outline-none"
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

/**
 * Calcula a alíquota de IR com base na duração do investimento.
 */
export function getAliquotaIR(
  dataInvestimento: Date,
  dataReferencia: Date = new Date(),
  tipoTributacao: TipoTributacao = "regressivo"
): number {
  if (tipoTributacao === "isento") return 0;

  const diffTime = Math.abs(dataReferencia.getTime() - dataInvestimento.getTime());
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
  taxa_mensal?: number; // IPCA
  data_inicio: string;
}

/**
 * Retorna uma chave formatada YYYY-MM para busca de IPCA.
 */
export function getIPCAKey(date: Date): string {
  const d = new Date(date);
  // IPCA é mensal, usamos o ano e mês
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

/**
 * Retorna as competências de IPCA válidas ordenadas por data_inicio crescente,
 * garantindo uma entrada por competência (mês).
 */
export function getIPCACompetencias(indexadores: IndexadorHistorico[]): IndexadorHistorico[] {
  const map = new Map<string, IndexadorHistorico>();
  const ipcas = (indexadores || [])
    .filter(
      (i) =>
        i.tipo === "IPCA" &&
        i.taxa_mensal !== undefined &&
        i.taxa_mensal !== null &&
        !isNaN(Number(i.taxa_mensal)) &&
        i.data_inicio
    )
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

  for (const item of ipcas) {
    const key = item.data_inicio.slice(0, 7); // YYYY-MM
    map.set(key, item);
  }

  return Array.from(map.values()).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
}

/**
 * Calcula o IPCA acumulado composto dos últimos 12 meses:
 * IPCA_12M = [(1 + taxa_1) * (1 + taxa_2) * ... * (1 + taxa_12) - 1] * 100
 * Retorna null se não houver pelo menos 12 competências consecutivas disponíveis.
 */
export function calcularIPCA12M(indexadores: IndexadorHistorico[]): number | null {
  const competencias = getIPCACompetencias(indexadores);
  if (competencias.length < 12) {
    return null;
  }

  const ultimas12 = competencias.slice(-12);

  // Confirmação de 12 meses estritamente consecutivos (sem competências ausentes/lacunas)
  for (let i = 1; i < ultimas12.length; i++) {
    const [prevY, prevM] = ultimas12[i - 1].data_inicio.slice(0, 7).split("-").map(Number);
    const [currY, currM] = ultimas12[i].data_inicio.slice(0, 7).split("-").map(Number);
    const expectedY = prevM === 12 ? prevY + 1 : prevY;
    const expectedM = prevM === 12 ? 1 : prevM + 1;
    if (currY !== expectedY || currM !== expectedM) {
      return null;
    }
  }

  let fator = 1;
  for (const comp of ultimas12) {
    fator *= (1 + Number(comp.taxa_mensal));
  }
  return (fator - 1) * 100;
}

/**
 * Retorna a taxa mensal do IPCA mais recente (em formato decimal).
 */
export function getLatestIPCAMensal(indexadores: IndexadorHistorico[]): number | null {
  const competencias = getIPCACompetencias(indexadores);
  if (competencias.length === 0) {
    return null;
  }
  return Number(competencias[competencias.length - 1].taxa_mensal);
}

/**
 * Calcula a rentabilidade bruta de investimentos IPCA+:
 * Rentabilidade = [(1 + IPCA_12M) * (1 + taxa_real) - 1] * 100
 */
export function calcularRentabilidadeIPCAPlus(ipca12M: number | null, taxaRealPercent: number): number {
  const realDec = (taxaRealPercent || 0) / 100;
  if (ipca12M === null) {
    return taxaRealPercent || 0;
  }
  const ipcaDec = ipca12M / 100;
  return ((1 + ipcaDec) * (1 + realDec) - 1) * 100;
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

/**
 * Retorna o próximo dia útil a partir de uma data.
 */
export function proximoDiaUtil(date: Date): Date {
  const proximo = new Date(date);
  proximo.setDate(proximo.getDate() + 1);
  while (!isDiaUtil(proximo)) {
    proximo.setDate(proximo.getDate() + 1);
  }
  return proximo;
}

/**
 * Ajusta a data de aplicação informada pelo usuário para alinhar o rendimento (D+1)
 * com o saldo real da corretora sem o usuário precisar ajustar manualmente.
 */
function normalizarDataAplicacao(dataUI: Date | string): Date {
  const d = typeof dataUI === 'string' ? new Date(dataUI + "T12:00:00") : new Date(dataUI);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return d;
}

export function buildIndexadorMap(indexadores: IndexadorHistorico[]): Map<string, number> {
  const map = new Map<string, number>();

  if (!indexadores || indexadores.length === 0) return map;

  for (const item of indexadores) {
    if (!item.data_inicio) continue;
    
    if (item.tipo === "IPCA") {
      // IPCA usa chave YYYY-MM e taxa_mensal (Extração direta da string para evitar timezone)
      const parts = item.data_inicio.split("-");
      const key = `${parts[0]}-${parts[1]}`;
      if (item.taxa_mensal != null) {
        map.set(key, Number(item.taxa_mensal));
      }
    } else {
      // CDI usa chave YYYY-MM-DD e taxa_diaria
      const key = item.data_inicio.split('T')[0];
      if (item.taxa_diaria != null) {
        map.set(key, Number(item.taxa_diaria));
      }
    }
  }

  return map;
}

/**
 * Motor de Cálculo de Rendimento (Engine Real)
 * Baseado no padrão de mercado brasileiro (B3/CDB):
 * - Capitalização bruta diária em dias úteis
 * - IR regressivo aplicado sobre o lucro total ao final
 * - Rendimento começa em D+1 ÚTIL (Ajustado internamente)
 */
export function calcularRendimentoComCDI({
  valorInicial,
  dataInicio,
  dataFim = null, // data limite do cálculo ou resgate
  dataVencimento = null, // data de vencimento opcional
  indexadorMap = new Map(),
  indexador = "CDI",
  percentualIndexador = 100,
  taxaFixaAnual = null,
  tipoTributacao = "regressivo",
}: {
  valorInicial: number;
  dataInicio: string | Date;
  dataFim?: string | Date | null;
  dataVencimento?: string | Date | null;
  indexadorMap?: Map<string, number>;
  indexador?: string;
  percentualIndexador?: number;
  taxaFixaAnual?: number | null;
  tipoTributacao?: TipoTributacao;
}): { valorAtual: number; ultimaTaxaAplicada: number; rendimentoBrutoAcumulado: number; irProvisionado: number; aliquotaAplicada: number } {
  let valorBruto = valorInicial;

  // 🔥 Normalização Interna:
  // Voltamos 1 dia na data de aplicação para que o proximoDiaUtil(data - 1) 
  // resulte na própria data de aplicação caso seja dia útil, 
  // Início do rendimento: 
  // IPCA começa no mesmo dia (D+0).
  // CDI mantém o padrão de mercado (D+1 útil após normalizar).
  const inicioNormalizado = normalizarDataAplicacao(dataInicio);
  let primeiroDiaYield: Date;
  
  if (indexador === "IPCA") {
    primeiroDiaYield = typeof dataInicio === 'string' ? new Date(dataInicio + "T12:00:00") : new Date(dataInicio);
    primeiroDiaYield.setHours(12, 0, 0, 0);
  } else {
    primeiroDiaYield = proximoDiaUtil(inicioNormalizado);
  }

  // Data de referência do cálculo (hoje ou data de resgate)
  const refDate = dataFim
    ? (typeof dataFim === 'string' ? new Date(dataFim.split('T')[0] + "T12:00:00") : new Date(dataFim))
    : new Date();
  refDate.setHours(12, 0, 0, 0);

  // Data de vencimento e dia seguinte
  let vencDate: Date | null = null;
  let diaAposVencimento: Date | null = null;
  if (dataVencimento) {
    vencDate = typeof dataVencimento === 'string'
      ? new Date(dataVencimento.split('T')[0] + "T12:00:00")
      : new Date(dataVencimento);
    vencDate.setHours(12, 0, 0, 0);
    diaAposVencimento = new Date(vencDate);
    diaAposVencimento.setDate(diaAposVencimento.getDate() + 1);
  }

  // A data de vencimento é o limite final da acumulação de rendimentos.
  // Quando refDate >= vencDate, o rendimento é calculado até a data de vencimento (inclusiva),
  // e interrompido a partir do dia seguinte (d < diaAposVencimento).
  const hoje = (vencDate && diaAposVencimento && refDate >= vencDate)
    ? diaAposVencimento
    : refDate;

  let ultimaTaxa = 0;
  let ultimaTaxaAplicada = 0;

  // Busca de semente retroativa (Fallback para indexadores - Apenas CDI)
  if (indexador === "CDI" && indexadorMap.size > 0 && taxaFixaAnual === null) {
    let dataSemente = new Date(inicioNormalizado);
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

  let ultimoMesProcessado = -1;

  // Loop de Capitalização Bruta
  for (let d = new Date(primeiroDiaYield); d < hoje; d.setDate(d.getDate() + 1)) {
    // CDI só roda em dias úteis. IPCA roda todos os dias (inflação é mensal, juros são diários).
    if (indexador !== "IPCA" && !isDiaUtil(d)) continue;

    if (indexador === "IPCA") {
      // Defasagem variável de mercado (Padrão Tesouro Direto / Anbima): 
      // Até dia 15: competência M-2
      // Após dia 15: competência M-1
      // Uso de subMonths previne overflow de dias em meses de 31 dias (ex: 31/10 - 1m = 30/09)
      const dRef = d.getDate() <= 15 ? subMonths(d, 2) : subMonths(d, 1);
      const year = dRef.getFullYear();
      const month = String(dRef.getMonth() + 1).padStart(2, "0");
      const chaveMes = `${year}-${month}`;
      let ipcaMensal = indexadorMap.get(chaveMes);

      // Períodos sem divulgação oficial ou lacunas:
      // Não inventar taxas futuras nem reaplicar meses antigos como se fossem taxa oficial
      if (ipcaMensal === undefined || ipcaMensal === null) {
        ipcaMensal = 0;
      }

      // 1. Converter IPCA mensal para diário (Decomposição exponencial pro-rata com dias reais do mês)
      const diasNoMes = new Date(year, dRef.getMonth() + 1, 0).getDate();
      const ipcaDiario = Math.pow(1 + ipcaMensal, 1 / diasNoMes) - 1;

      // 2. Aplicação da Taxa Real (Juros Spread) - Diariamente
      const taxaFixaAnualDecimal = (percentualIndexador || 0) > 1 
        ? (percentualIndexador || 0) / 100 
        : (percentualIndexador || 0);

      // Taxa fixa diária (Base 365 dias calendarizados)
      const taxaFixaDiaria = Math.pow(1 + taxaFixaAnualDecimal, 1 / 365) - 1;
      
      // Composição diária: IPCA + Spread Fixa
      const taxaDia = (1 + ipcaDiario) * (1 + taxaFixaDiaria) - 1;

      valorBruto *= (1 + taxaDia);
      
      ultimaTaxa = ipcaMensal;
      ultimaTaxaAplicada = taxaDia;
    } else {
      // LOGICA CDI (MANTIDA)
      const key = formatDateKey(d);
      let taxaBase: number | undefined = undefined;

      if (taxaFixaAnual !== null) {
        taxaBase = taxaDiariaFixa;
      } else {
        const taxaDia = indexadorMap.get(key);
        const isHoje = formatDateKey(d) === formatDateKey(hoje);

        if (taxaDia !== undefined && taxaDia !== null && taxaDia > 0) {
          taxaBase = taxaDia;
        } else if (isHoje && ultimaTaxa > 0) {
          taxaBase = ultimaTaxa;
        }
      }

      if (taxaBase !== undefined && taxaBase > 0) {
        const taxa = taxaBase * (percentualIndexador / 100);
        valorBruto *= (1 + taxa);
        
        ultimaTaxa = indexadorMap.get(key) || ultimaTaxa; 
        ultimaTaxaAplicada = taxa;
      }
    }
  }

  // Se a data de referência for posterior ou igual ao vencimento, o investimento já venceu:
  // Não há mais taxa diária aplicada após a data limite de rentabilidade.
  const isVencido = vencDate ? (refDate >= vencDate) : false;
  if (isVencido) {
    ultimaTaxaAplicada = 0;
  }

  // Cálculo de IR e Finalização
  // Para fins tributários de permanência, usamos a data UI original (que é inicioNormalizado + 1 dia)
  const dataReferenciaIR = new Date(inicioNormalizado);
  dataReferenciaIR.setDate(dataReferenciaIR.getDate() + 1);

  const lucroTotal = valorBruto - valorInicial;
  // O prazo de permanência para o IR é limitado à data de vencimento quando vencido
  const dataFimIR = (vencDate && refDate >= vencDate) ? vencDate : refDate;
  const aliquota = getAliquotaIR(dataReferenciaIR, dataFimIR, tipoTributacao);
  
  const ir = Math.round(lucroTotal * (aliquota / 100) * 100) / 100;
  const valorLiquido = Math.round((valorBruto - ir) * 100) / 100;
  const rendimentoBrutoAcumulado = Math.round(lucroTotal * 100) / 100;

  return { 
    valorAtual: valorLiquido, 
    ultimaTaxaAplicada, 
    rendimentoBrutoAcumulado, 
    irProvisionado: ir,
    aliquotaAplicada: aliquota
  };
}

/**
 * Formata data de vencimento no padrão compacto (ex: "21 Out 2026")
 */
export function formatVencimentoDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = typeof dateStr === 'string'
    ? new Date(dateStr.split('T')[0] + "T12:00:00")
    : new Date(dateStr);
  const raw = format(d, "dd MMM yyyy", { locale: ptBR });
  return raw.replace(/(\d{1,2})\s+([a-zçãõ]+)\s+(\d{4})/i, (_, day, mon, year) => {
    const cleanMon = mon.replace('.', '');
    const capMon = cleanMon.charAt(0).toUpperCase() + cleanMon.slice(1);
    return `${day} ${capMon} ${year}`;
  });
}

export const getFullName = (profile: any, user: any): string => {
  return profile?.nome || user?.user_metadata?.nome || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
};

export const getDisplayName = (profile: any, user: any): string => {
  if (profile?.apelido?.trim()) {
    return profile.apelido.trim();
  }
  const fullName = getFullName(profile, user);
  return fullName.split(' ')[0];
};
