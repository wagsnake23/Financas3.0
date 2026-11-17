import {
  Investment,
  InvestmentContribution,
  InvestmentRedemptionAllocation,
  InvestmentLotCalculation,
  InvestmentConsolidatedMetrics,
} from "@/types/finance";
import {
  calcularRendimentoComCDI,
  calcularRentabilidadeIPCAPlus,
  formatInTimeZone,
  TARGET_TIMEZONE,
  TipoTributacao,
} from "@/lib/utils";

/**
 * Ordenação estrita e determinística FIFO:
 * 1. Menor data_aporte
 * 2. Menor created_at
 * 3. Identificador id do aporte
 */
export function sortAportesFIFO(
  a: InvestmentContribution,
  b: InvestmentContribution
): number {
  if (a.data_aporte !== b.data_aporte) {
    return a.data_aporte.localeCompare(b.data_aporte);
  }
  const timeA = new Date(a.created_at).getTime();
  const timeB = new Date(b.created_at).getTime();
  if (timeA !== timeB) {
    return timeA - timeB;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Arredondamento monetário seguro para duas casas decimais.
 */
export function roundCurrency(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export interface CalcularLotesParams {
  investimento: Investment;
  aportes: InvestmentContribution[];
  alocacoes: InvestmentRedemptionAllocation[];
  indexadorMapCDI: Map<string, number>;
  indexadorMapIPCA: Map<string, number>;
  tipoTributacao: TipoTributacao;
  cdi: number;
  ipca12M: number | null;
  dataCorte?: string | Date | null;
}

/**
 * Calcula individualmente cada aporte utilizando o motor existente (calcularRendimentoComCDI)
 * e consolida os resultados do investimento.
 */
export function calcularLotesInvestimento({
  investimento,
  aportes,
  alocacoes,
  indexadorMapCDI,
  indexadorMapIPCA,
  tipoTributacao,
  cdi,
  ipca12M,
  dataCorte = null,
}: CalcularLotesParams): InvestmentConsolidatedMetrics {
  const aportesOrdenados = [...aportes].sort(sortAportesFIFO);

  // Mapear principal já consumido por aporte
  const principalConsumidoMap = new Map<string, number>();
  for (const aloc of alocacoes) {
    if (aloc.investimento_id === investimento.id) {
      const atual = principalConsumidoMap.get(aloc.aporte_id) || 0;
      principalConsumidoMap.set(aloc.aporte_id, roundCurrency(atual + aloc.principal_consumido));
    }
  }

  // Mapa de indexador aplicável
  let idxMap: Map<string, number> | undefined;
  if (investimento.tipo_rentabilidade === "indexado") {
    if (investimento.indexador === "CDI") idxMap = indexadorMapCDI;
    else if (investimento.indexador === "IPCA") idxMap = indexadorMapIPCA;
  }

  const pIndexador =
    investimento.tipo_rentabilidade === "indexado"
      ? investimento.percentual_indexador || 100
      : 100;

  const taxaFixaAnual =
    investimento.tipo_rentabilidade === "fixo"
      ? investimento.taxa_fixa || 0
      : null;

  const todayStr = formatInTimeZone(new Date(), TARGET_TIMEZONE, "yyyy-MM-dd");
  const dueDateStr = investimento.data_vencimento
    ? investimento.data_vencimento.split("T")[0]
    : null;
  const isVencido = Boolean(
    dueDateStr && todayStr >= dueDateStr && investimento.status !== "resgatado"
  );

  const lotes: InvestmentLotCalculation[] = [];

  let valorAplicadoTotal = 0; // soma dos principais remanescentes
  let valorOriginalTotal = 0;
  let principalJaResgatadoTotal = 0;
  let rendimentoBrutoTotal = 0;
  let irProvisionadoTotal = 0;
  let rendimentoLiquidoTotal = 0;
  let saldoLiquidoTotal = 0;
  let saldoBrutoVirtualTotal = 0;
  let rendimentoHojeLiquidoTotal = 0;

  // Variáveis para cálculo da taxa diária ponderada
  let somaPonderadaTaxaDiaria = 0;

  let numeroAporte = 1;
  for (const aporte of aportesOrdenados) {
    const original = roundCurrency(Number(aporte.valor_original));
    const jaResgatado = roundCurrency(principalConsumidoMap.get(aporte.id) || 0);
    const remanescente = roundCurrency(Math.max(0, original - jaResgatado));
    const isEsgotado = remanescente <= 0.009;

    valorOriginalTotal = roundCurrency(valorOriginalTotal + original);
    principalJaResgatadoTotal = roundCurrency(principalJaResgatadoTotal + jaResgatado);

    let rendimentoBrutoLote = 0;
    let irProvisionadoLote = 0;
    let aliquotaAplicadaLote = 0;
    let rendimentoLiquidoLote = 0;
    let saldoLiquidoLote = 0;
    let saldoBrutoVirtualLote = 0;
    let taxaDiariaLote = 0;
    let rendimentoHojeLiquidoLote = 0;

    if (!isEsgotado && remanescente > 0) {
      // Chamada obrigatória e individual ao motor existente
      const resultadoMotor = calcularRendimentoComCDI({
        valorInicial: remanescente,
        dataInicio: aporte.data_aporte,
        dataFim: dataCorte || investimento.data_resgate || null,
        dataVencimento: investimento.data_vencimento || null,
        indexadorMap: idxMap || new Map<string, number>(),
        indexador: investimento.indexador ?? "CDI",
        percentualIndexador: pIndexador,
        taxaFixaAnual,
        tipoTributacao,
      });

      saldoLiquidoLote = roundCurrency(resultadoMotor.valorAtual);
      rendimentoBrutoLote = roundCurrency(resultadoMotor.rendimentoBrutoAcumulado);
      irProvisionadoLote = roundCurrency(resultadoMotor.irProvisionado);
      aliquotaAplicadaLote = resultadoMotor.aliquotaAplicada;
      rendimentoLiquidoLote = roundCurrency(saldoLiquidoLote - remanescente);
      saldoBrutoVirtualLote = roundCurrency(remanescente + rendimentoBrutoLote);
      taxaDiariaLote = isVencido ? 0 : resultadoMotor.ultimaTaxaAplicada;

      const rendimentoBrutoDia = isVencido ? 0 : saldoLiquidoLote * taxaDiariaLote;
      rendimentoHojeLiquidoLote = isVencido
        ? 0
        : rendimentoBrutoDia * (1 - aliquotaAplicadaLote / 100);

      valorAplicadoTotal = roundCurrency(valorAplicadoTotal + remanescente);
      rendimentoBrutoTotal = roundCurrency(rendimentoBrutoTotal + rendimentoBrutoLote);
      irProvisionadoTotal = roundCurrency(irProvisionadoTotal + irProvisionadoLote);
      rendimentoLiquidoTotal = roundCurrency(rendimentoLiquidoTotal + rendimentoLiquidoLote);
      saldoLiquidoTotal = roundCurrency(saldoLiquidoTotal + saldoLiquidoLote);
      saldoBrutoVirtualTotal = roundCurrency(saldoBrutoVirtualTotal + saldoBrutoVirtualLote);
      rendimentoHojeLiquidoTotal = roundCurrency(
        rendimentoHojeLiquidoTotal + rendimentoHojeLiquidoLote
      );

      somaPonderadaTaxaDiaria += saldoLiquidoLote * taxaDiariaLote;
    }

    lotes.push({
      aporte,
      numero: numeroAporte++,
      principalOriginal: original,
      principalJaResgatado: jaResgatado,
      principalRemanescente: remanescente,
      isEsgotado,
      rendimentoBruto: rendimentoBrutoLote,
      irProvisionado: irProvisionadoLote,
      aliquotaAplicada: aliquotaAplicadaLote,
      rendimentoLiquido: rendimentoLiquidoLote,
      saldoLiquido: saldoLiquidoLote,
      saldoBrutoVirtual: saldoBrutoVirtualLote,
      ultimaTaxaAplicada: taxaDiariaLote,
      rendimentoHojeLiquido: rendimentoHojeLiquidoLote,
    });
  }

  // Taxa média ponderada
  const taxaDiariaPonderada =
    saldoLiquidoTotal > 0 ? somaPonderadaTaxaDiaria / saldoLiquidoTotal : 0;

  // Rentabilidade Bruta do investimento conforme parâmetros
  const rentabilidadeBrutaAnual =
    investimento.tipo_rentabilidade === "indexado"
      ? investimento.indexador === "CDI"
        ? (cdi * (investimento.percentual_indexador || 100)) / 100
        : calcularRentabilidadeIPCAPlus(ipca12M, investimento.percentual_indexador || 0)
      : investimento.taxa_fixa || 0;

  // Alíquota média ponderada pelo IR provisionado sobre o rendimento bruto acumulado
  const aliquotaMediaPonderada =
    rendimentoBrutoTotal > 0
      ? (irProvisionadoTotal / rendimentoBrutoTotal) * 100
      : (lotes.find((l) => !l.isEsgotado)?.aliquotaAplicada ?? 0);

  const rentabilidadeLiquidaAnual =
    rentabilidadeBrutaAnual * (1 - aliquotaMediaPonderada / 100);

  // Rendimento mensal estimado com base em 21 dias úteis conforme regra dos minicards
  const monthlyRate = Math.pow(1 + taxaDiariaPonderada, 21) - 1;
  const rendimentoMesTotal = isVencido
    ? 0
    : roundCurrency(saldoBrutoVirtualTotal * monthlyRate);

  // Rendimento mensal líquido estimado com base em 21 dias úteis
  const dailyRateLiquida = Math.pow(1 + (rentabilidadeLiquidaAnual / 100), 1 / 252) - 1;
  const dailyRateTruncated = Math.trunc(dailyRateLiquida * 1e10) / 1e10;
  const monthlyRateLiquida = Math.pow(1 + dailyRateTruncated, 21) - 1;
  const rendimentoMesLiquidoTotal = isVencido
    ? 0
    : roundCurrency(saldoLiquidoTotal * monthlyRateLiquida);

  const dataPrimeiroAporte =
    aportesOrdenados.length > 0
      ? aportesOrdenados[0].data_aporte
      : investimento.data;

  return {
    investimento,
    aportes: aportesOrdenados,
    lotes,
    totalAportes: aportesOrdenados.length,
    valorAplicadoTotal,
    valorOriginalTotal,
    principalJaResgatadoTotal,
    rendimentoBrutoTotal,
    irProvisionadoTotal,
    rendimentoLiquidoTotal,
    saldoLiquidoTotal,
    saldoBrutoVirtualTotal,
    rendimentoHojeLiquidoTotal,
    rendimentoMesTotal,
    rendimentoMesLiquidoTotal,
    taxaDiariaPonderada,
    rentabilidadeBrutaAnual,
    rentabilidadeLiquidaAnual,
    dataPrimeiroAporte,
    isVencido,
    dueDateStr,
  };
}

export interface SimulacaoResgateResultado {
  valido: boolean;
  erro?: string;
  tipoResgate: "parcial" | "total";
  valorLiquidoSolicitado: number;
  valorLiquidoTotal: number;
  valorBrutoTotal: number;
  rendimentoBrutoTotal: number;
  irTotal: number;
  principalTotalConsumido: number;
  alocacoes: Array<{
    aporte_id: string;
    numeroAporte: number;
    data_aporte: string;
    principal_consumido: number;
    valor_bruto_resgatado: number;
    rendimento_bruto: number;
    ir_retido: number;
    valor_liquido: number;
    aliquota_ir: number;
    principal_remanescente_pos: number;
    isTotalmenteConsumido: boolean;
  }>;
}

/**
 * Simula a distribuição FIFO de um resgate parcial ou total.
 * Garante que:
 * 1. A ordem FIFO seja rigorosamente seguida.
 * 2. Cada lote aplique sua tributação individual.
 * 3. A soma dos valores líquidos alocados seja exatamente igual ao valor líquido solicitado.
 * 4. Arredondamentos em centavos sejam ajustados de forma controlada.
 */
export function simularResgateFIFO(
  lotes: InvestmentLotCalculation[],
  tipoResgate: "parcial" | "total",
  valorLiquidoSolicitado: number
): SimulacaoResgateResultado {
  const lotesAtivos = lotes.filter((l) => !l.isEsgotado && l.principalRemanescente > 0);

  const saldoLiquidoTotalDisponivel = roundCurrency(
    lotesAtivos.reduce((sum, l) => sum + l.saldoLiquido, 0)
  );

  if (saldoLiquidoTotalDisponivel <= 0) {
    return {
      valido: false,
      erro: "Investimento não possui saldo disponível para resgate.",
      tipoResgate,
      valorLiquidoSolicitado,
      valorLiquidoTotal: 0,
      valorBrutoTotal: 0,
      rendimentoBrutoTotal: 0,
      irTotal: 0,
      principalTotalConsumido: 0,
      alocacoes: [],
    };
  }

  // Se for resgate total, o valor líquido solicitado é todo o saldo disponível
  const valorSolicitadoEfetivo =
    tipoResgate === "total"
      ? saldoLiquidoTotalDisponivel
      : roundCurrency(valorLiquidoSolicitado);

  if (valorSolicitadoEfetivo <= 0) {
    return {
      valido: false,
      erro: "Informe um valor de resgate maior que zero.",
      tipoResgate,
      valorLiquidoSolicitado,
      valorLiquidoTotal: 0,
      valorBrutoTotal: 0,
      rendimentoBrutoTotal: 0,
      irTotal: 0,
      principalTotalConsumido: 0,
      alocacoes: [],
    };
  }

  if (valorSolicitadoEfetivo > saldoLiquidoTotalDisponivel + 0.01) {
    return {
      valido: false,
      erro: `Valor solicitado (R$ ${valorSolicitadoEfetivo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) é superior ao saldo líquido disponível (R$ ${saldoLiquidoTotalDisponivel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).`,
      tipoResgate,
      valorLiquidoSolicitado,
      valorLiquidoTotal: 0,
      valorBrutoTotal: 0,
      rendimentoBrutoTotal: 0,
      irTotal: 0,
      principalTotalConsumido: 0,
      alocacoes: [],
    };
  }

  let restanteLiquido = Math.min(valorSolicitadoEfetivo, saldoLiquidoTotalDisponivel);
  const alocacoes: SimulacaoResgateResultado["alocacoes"] = [];

  let somaLiquidoAlocado = 0;
  let somaBrutoAlocado = 0;
  let somaRendimentoAlocado = 0;
  let somaIrAlocado = 0;
  let somaPrincipalAlocado = 0;

  for (let i = 0; i < lotesAtivos.length; i++) {
    if (restanteLiquido <= 0.001) break;

    const lote = lotesAtivos[i];
    const saldoLote = lote.saldoLiquido;
    const isUltimoLoteNecessario = restanteLiquido <= saldoLote + 0.01;

    let liquidoLote: number;
    let principalConsumidoLote: number;
    let rendimentoBrutoLote: number;
    let irRetidoLote: number;
    let valorBrutoLote: number;

    if (isUltimoLoteNecessario && tipoResgate === "parcial" && restanteLiquido < saldoLote - 0.01) {
      // Consumo parcial deste lote
      liquidoLote = roundCurrency(restanteLiquido);
      const fracao = saldoLote > 0 ? liquidoLote / saldoLote : 0;

      principalConsumidoLote = roundCurrency(lote.principalRemanescente * fracao);
      rendimentoBrutoLote = roundCurrency(lote.rendimentoBruto * fracao);
      irRetidoLote = roundCurrency(lote.irProvisionado * fracao);

      // Garantir coerência: Bruto - IR = Líquido
      valorBrutoLote = roundCurrency(principalConsumidoLote + rendimentoBrutoLote);
      const liquidoCalculado = roundCurrency(valorBrutoLote - irRetidoLote);

      // Ajuste fino de centavo caso haja descompasso de arredondamento
      const diffCentavo = roundCurrency(liquidoLote - liquidoCalculado);
      if (diffCentavo !== 0) {
        if (rendimentoBrutoLote + diffCentavo >= 0) {
          rendimentoBrutoLote = roundCurrency(rendimentoBrutoLote + diffCentavo);
          valorBrutoLote = roundCurrency(principalConsumidoLote + rendimentoBrutoLote);
        } else {
          principalConsumidoLote = roundCurrency(principalConsumidoLote + diffCentavo);
          valorBrutoLote = roundCurrency(principalConsumidoLote + rendimentoBrutoLote);
        }
      }

      // Proteger para nunca consumir mais que o principal do lote
      if (principalConsumidoLote > lote.principalRemanescente) {
        principalConsumidoLote = lote.principalRemanescente;
      }

      restanteLiquido = 0;
    } else {
      // Consumo total deste lote
      liquidoLote = roundCurrency(Math.min(restanteLiquido, saldoLote));
      principalConsumidoLote = lote.principalRemanescente;
      rendimentoBrutoLote = lote.rendimentoBruto;
      irRetidoLote = lote.irProvisionado;
      valorBrutoLote = roundCurrency(principalConsumidoLote + rendimentoBrutoLote);
      restanteLiquido = roundCurrency(restanteLiquido - liquidoLote);
    }

    const principalRemanescentePos = roundCurrency(
      Math.max(0, lote.principalRemanescente - principalConsumidoLote)
    );
    const isTotalmenteConsumido = principalRemanescentePos <= 0.009;

    alocacoes.push({
      aporte_id: lote.aporte.id,
      numeroAporte: lote.numero,
      data_aporte: lote.aporte.data_aporte,
      principal_consumido: principalConsumidoLote,
      valor_bruto_resgatado: valorBrutoLote,
      rendimento_bruto: rendimentoBrutoLote,
      ir_retido: irRetidoLote,
      valor_liquido: liquidoLote,
      aliquota_ir: lote.aliquotaAplicada,
      principal_remanescente_pos: principalRemanescentePos,
      isTotalmenteConsumido,
    });

    somaLiquidoAlocado = roundCurrency(somaLiquidoAlocado + liquidoLote);
    somaBrutoAlocado = roundCurrency(somaBrutoAlocado + valorBrutoLote);
    somaRendimentoAlocado = roundCurrency(somaRendimentoAlocado + rendimentoBrutoLote);
    somaIrAlocado = roundCurrency(somaIrAlocado + irRetidoLote);
    somaPrincipalAlocado = roundCurrency(somaPrincipalAlocado + principalConsumidoLote);
  }

  // Ajuste do centavo final para que somaLiquidoAlocado === valorSolicitadoEfetivo
  if (alocacoes.length > 0 && Math.abs(somaLiquidoAlocado - valorSolicitadoEfetivo) > 0.001) {
    const diff = roundCurrency(valorSolicitadoEfetivo - somaLiquidoAlocado);
    const ultima = alocacoes[alocacoes.length - 1];
    ultima.valor_liquido = roundCurrency(ultima.valor_liquido + diff);
    ultima.valor_bruto_resgatado = roundCurrency(ultima.valor_bruto_resgatado + diff);
    ultima.rendimento_bruto = roundCurrency(ultima.rendimento_bruto + diff);
    somaLiquidoAlocado = valorSolicitadoEfetivo;
    somaBrutoAlocado = roundCurrency(somaBrutoAlocado + diff);
    somaRendimentoAlocado = roundCurrency(somaRendimentoAlocado + diff);
  }

  return {
    valido: true,
    tipoResgate,
    valorLiquidoSolicitado: valorSolicitadoEfetivo,
    valorLiquidoTotal: somaLiquidoAlocado,
    valorBrutoTotal: somaBrutoAlocado,
    rendimentoBrutoTotal: somaRendimentoAlocado,
    irTotal: somaIrAlocado,
    principalTotalConsumido: somaPrincipalAlocado,
    alocacoes,
  };
}

