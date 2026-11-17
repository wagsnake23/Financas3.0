import {
  calcularLotesInvestimento,
  simularResgateFIFO,
  sortAportesFIFO,
  roundCurrency,
} from "../src/lib/investmentsFifo";
import { calcularRendimentoComCDI } from "../src/lib/utils";
import {
  Investment,
  InvestmentContribution,
  InvestmentRedemptionAllocation,
} from "../src/types/finance";

console.log("=================================================");
console.log("INICIANDO BATERIA DE TESTES — 10 CENÁRIOS OBRIGATÓRIOS");
console.log("=================================================\n");

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}`, details || "");
  }
}

// Mock de indexadores
const indexadorMapCDI = new Map<string, number>();
indexadorMapCDI.set("2026-01-10", 0.0004);
indexadorMapCDI.set("2026-04-10", 0.0004);
indexadorMapCDI.set("2026-08-10", 0.0004);
const indexadorMapIPCA = new Map<string, number>();
const cdi = 10.65;
const ipca12M = 4.2;

// =========================================================================
// Cenário 1 — Migração
// =========================================================================
console.log("\n--- Cenário 1 — Migração de Investimento Existente ---");
const invAntigo: Investment = {
  id: "inv-1",
  user_id: "user-1",
  nome: "CDB Banco Inter",
  tipo: "fixed",
  valor: 20000,
  data: "2026-01-10",
  tipo_rentabilidade: "fixo",
  taxa_fixa: 12,
  status: "ativo",
  origem_investimento: "saldo_atual",
};

const aporteInicial: InvestmentContribution = {
  id: "ap-1",
  investimento_id: invAntigo.id,
  user_id: invAntigo.user_id,
  valor_original: invAntigo.valor,
  data_aporte: invAntigo.data,
  created_at: "2026-01-10T10:00:00Z",
};

const c1 = calcularLotesInvestimento({
  investimento: invAntigo,
  aportes: [aporteInicial],
  alocacoes: [],
  indexadorMapCDI,
  indexadorMapIPCA,
  tipoTributacao: "regressivo",
  cdi,
  ipca12M,
  dataCorte: "2026-06-01",
});

assert(c1.totalAportes === 1, "Cenário 1: Total de aportes é exatamente 1");
assert(c1.valorOriginalTotal === 20000, "Cenário 1: Valor original preservado idêntico");
assert(c1.valorAplicadoTotal === 20000, "Cenário 1: Valor aplicado preservado");
assert(c1.dataPrimeiroAporte === "2026-01-10", "Cenário 1: Data do aporte inicial preservada");

// =========================================================================
// Cenário 2 — Novo Aporte
// =========================================================================
console.log("\n--- Cenário 2 — Adição de Novo Aporte ---");
const aporte2: InvestmentContribution = {
  id: "ap-2",
  investimento_id: invAntigo.id,
  user_id: invAntigo.user_id,
  valor_original: 10000,
  data_aporte: "2026-03-15",
  created_at: "2026-03-15T14:00:00Z",
};

const c2 = calcularLotesInvestimento({
  investimento: invAntigo,
  aportes: [aporteInicial, aporte2],
  alocacoes: [],
  indexadorMapCDI,
  indexadorMapIPCA,
  tipoTributacao: "regressivo",
  cdi,
  ipca12M,
  dataCorte: "2026-06-01",
});

assert(c2.totalAportes === 2, "Cenário 2: Total de aportes agora é 2");
assert(c2.valorOriginalTotal === 30000, "Cenário 2: Soma dos valores originais = 30.000");
assert(c2.valorAplicadoTotal === 30000, "Cenário 2: Principal remanescente total = 30.000");
assert(c2.investimento.id === invAntigo.id, "Cenário 2: Investimento mestre único (não duplicado)");

// =========================================================================
// Cenário 3 — Datas Diferentes (Cálculo individual por lote)
// =========================================================================
console.log("\n--- Cenário 3 — Três Aportes com Datas Diferentes ---");
const aporte3: InvestmentContribution = {
  id: "ap-3",
  investimento_id: invAntigo.id,
  user_id: invAntigo.user_id,
  valor_original: 5000,
  data_aporte: "2026-05-01",
  created_at: "2026-05-01T09:00:00Z",
};

const c3 = calcularLotesInvestimento({
  investimento: invAntigo,
  aportes: [aporteInicial, aporte2, aporte3],
  alocacoes: [],
  indexadorMapCDI,
  indexadorMapIPCA,
  tipoTributacao: "regressivo",
  cdi,
  ipca12M,
  dataCorte: "2026-06-01",
});

// Aporte 1 tem ~5 meses de rendimento, Aporte 2 tem ~2.5 meses, Aporte 3 tem ~1 mês
assert(c3.lotes[0].rendimentoBruto > c3.lotes[1].rendimentoBruto, "Cenário 3: Lote 1 rendeu mais que Lote 2 devido ao maior prazo");
assert(c3.lotes[1].rendimentoBruto > c3.lotes[2].rendimentoBruto, "Cenário 3: Lote 2 rendeu mais que Lote 3");
const somaBrutaIndividual = roundCurrency(
  c3.lotes[0].rendimentoBruto + c3.lotes[1].rendimentoBruto + c3.lotes[2].rendimentoBruto
);
assert(Math.abs(c3.rendimentoBrutoTotal - somaBrutaIndividual) < 0.01, "Cenário 3: Rendimento consolidado é exatamente a soma dos lotes");

// =========================================================================
// Cenário 4 — Resgate Parcial no Primeiro Lote
// =========================================================================
console.log("\n--- Cenário 4 — Resgate Parcial no Primeiro Lote ---");
// Saldo líquido do lote 1 é > 20.000. Vamos solicitar resgate líquido de R$ 5.000.
const sim4 = simularResgateFIFO(c3.lotes, "parcial", 5000);

assert(sim4.valido === true, "Cenário 4: Simulação de resgate válida");
assert(sim4.valorLiquidoTotal === 5000, "Cenário 4: Valor líquido entregue exatamente R$ 5.000,00");
assert(sim4.alocacoes.length === 1, "Cenário 4: Apenas o lote 1 foi consumido");
assert(sim4.alocacoes[0].aporte_id === "ap-1", "Cenário 4: Lote consumido é o mais antigo (ap-1)");
assert(sim4.alocacoes[0].isTotalmenteConsumido === false, "Cenário 4: Lote 1 não foi totalmente consumido");
assert(sim4.alocacoes[0].principal_remanescente_pos > 14000, "Cenário 4: Lote 1 preservou seu principal remanescente");

// =========================================================================
// Cenário 5 — Resgate Envolvendo Vários Lotes (FIFO)
// =========================================================================
console.log("\n--- Cenário 5 — Resgate Envolvendo Múltiplos Lotes ---");
// Lote 1 tem cerca de R$ 20.800 líquido. Pedir R$ 25.000 líquido força consumir todo lote 1 e parte do lote 2.
const saldoLote1 = c3.lotes[0].saldoLiquido;
const valorSolicitado5 = roundCurrency(saldoLote1 + 3000);
const sim5 = simularResgateFIFO(c3.lotes, "parcial", valorSolicitado5);

assert(sim5.valido === true, "Cenário 5: Simulação válida");
assert(sim5.valorLiquidoTotal === valorSolicitado5, "Cenário 5: Valor líquido recebido exatamente igual ao solicitado");
assert(sim5.alocacoes.length === 2, "Cenário 5: Exatamente 2 lotes consumidos");
assert(sim5.alocacoes[0].aporte_id === "ap-1", "Cenário 5: Primeiro lote consumido foi ap-1");
assert(sim5.alocacoes[0].isTotalmenteConsumido === true, "Cenário 5: Lote 1 esgotado (100% consumido)");
assert(sim5.alocacoes[1].aporte_id === "ap-2", "Cenário 5: Segundo lote consumido foi ap-2");
assert(sim5.alocacoes[1].isTotalmenteConsumido === false, "Cenário 5: Lote 2 consumido apenas parcialmente");
assert(!sim5.alocacoes.some((a) => a.aporte_id === "ap-3"), "Cenário 5: Lote 3 permaneceu 100% intacto");

// =========================================================================
// Cenário 6 — Tributação Diferenciada por Lote
// =========================================================================
console.log("\n--- Cenário 6 — Alíquotas e Tributação por Lote ---");
// Lote 1 e Lote 3 têm prazos e rendimentos diferentes.
assert(sim5.alocacoes[0].aliquota_ir > 0, "Cenário 6: Lote 1 calculou sua própria alíquota");
assert(sim5.alocacoes[1].aliquota_ir > 0, "Cenário 6: Lote 2 calculou sua própria alíquota");
const irTotalCalculado = roundCurrency(sim5.alocacoes[0].ir_retido + sim5.alocacoes[1].ir_retido);
assert(Math.abs(sim5.irTotal - irTotalCalculado) < 0.01, "Cenário 6: IR total é soma exata dos IRs retidos");
assert(
  roundCurrency(sim5.valorBrutoTotal - sim5.irTotal) === sim5.valorLiquidoTotal,
  "Cenário 6: Equação fundamental mantida: Bruto - IR = Líquido"
);

// =========================================================================
// Cenário 7 — Resgate Total
// =========================================================================
console.log("\n--- Cenário 7 — Resgate Total ---");
const sim7 = simularResgateFIFO(c3.lotes, "total", 0);

assert(sim7.valido === true, "Cenário 7: Resgate total válido");
assert(sim7.alocacoes.length === 3, "Cenário 7: Todos os 3 lotes foram alocados");
assert(sim7.alocacoes.every((a) => a.isTotalmenteConsumido), "Cenário 7: Todos os 3 lotes foram marcados como esgotados");
assert(
  Math.abs(sim7.valorLiquidoTotal - c3.saldoLiquidoTotal) < 0.02,
  "Cenário 7: Valor líquido do resgate total é igual a todo o saldo líquido da carteira"
);

// =========================================================================
// Cenário 8 — Resgate Superior ao Disponível
// =========================================================================
console.log("\n--- Cenário 8 — Impedir Resgate Superior ao Saldo ---");
const valorExcessivo = roundCurrency(c3.saldoLiquidoTotal + 5000);
const sim8 = simularResgateFIFO(c3.lotes, "parcial", valorExcessivo);

assert(sim8.valido === false, "Cenário 8: Resgate superior ao saldo foi rejeitado");
assert(sim8.erro !== undefined && sim8.erro.includes("superior ao saldo"), "Cenário 8: Mensagem clara de erro emitida");

// =========================================================================
// Cenário 9 — Ordenação Determinística FIFO
// =========================================================================
console.log("\n--- Cenário 9 — Ordenação Determinística FIFO ---");
const apA: InvestmentContribution = { id: "a", investimento_id: "x", user_id: "u", valor_original: 100, data_aporte: "2026-02-01", created_at: "2026-02-01T12:00:00Z" };
const apB: InvestmentContribution = { id: "b", investimento_id: "x", user_id: "u", valor_original: 100, data_aporte: "2026-01-01", created_at: "2026-01-01T12:00:00Z" };
const apC: InvestmentContribution = { id: "c", investimento_id: "x", user_id: "u", valor_original: 100, data_aporte: "2026-02-01", created_at: "2026-02-01T10:00:00Z" };

const ordenados = [apA, apB, apC].sort(sortAportesFIFO);
assert(ordenados[0].id === "b", "Cenário 9: Menor data_aporte fica primeiro (2026-01-01)");
assert(ordenados[1].id === "c", "Cenário 9: Em empate de data, menor created_at fica primeiro (10:00 vs 12:00)");
assert(ordenados[2].id === "a", "Cenário 9: Terceiro lote fica no final determinístico");

// =========================================================================
// Cenário 10 — Regressão do Motor Intacto
// =========================================================================
console.log("\n--- Cenário 10 — Regressão e Validação do Motor calcularRendimentoComCDI ---");
// Executar motor diretamente com parâmetros de referência
const direto = calcularRendimentoComCDI({
  valorInicial: 20000,
  dataInicio: "2026-01-10",
  dataFim: "2026-06-01",
  dataVencimento: null,
  indexadorMap: indexadorMapCDI,
  indexador: "CDI",
  percentualIndexador: 100,
  taxaFixaAnual: 12,
  tipoTributacao: "regressivo",
});

// Executar via camada de consolidação de lote único
const loteUnico = calcularLotesInvestimento({
  investimento: invAntigo,
  aportes: [aporteInicial],
  alocacoes: [],
  indexadorMapCDI,
  indexadorMapIPCA,
  tipoTributacao: "regressivo",
  cdi,
  ipca12M,
  dataCorte: "2026-06-01",
});

assert(Math.abs(loteUnico.saldoLiquidoTotal - direto.valorAtual) < 0.01, "Cenário 10: Saldo líquido idêntico ao motor original");
assert(Math.abs(loteUnico.rendimentoBrutoTotal - direto.rendimentoBrutoAcumulado) < 0.01, "Cenário 10: Rendimento bruto idêntico ao motor original");
assert(Math.abs(loteUnico.irProvisionadoTotal - direto.irProvisionado) < 0.01, "Cenário 10: IR provisionado idêntico ao motor original");
assert(loteUnico.lotes[0].aliquotaAplicada === direto.aliquotaAplicada, "Cenário 10: Alíquota de IR idêntica");

// =========================================================================
// Cenário 11 — Validação dos Invariantes Financeiros da RPC e Backend FIFO
// =========================================================================
console.log("\n--- Cenário 11 — Validação dos Invariantes da RPC (Revisão Técnica) ---");

// 1. Invariante da Equação Fundamental para cada alocação: Bruto = Principal + Rendimento & Líquido = Bruto - IR
const todasAlocacoes = [...sim4.alocacoes, ...sim5.alocacoes, ...sim7.alocacoes];
const todasEquacoesValidas = todasAlocacoes.every((aloc) => {
  const eq1 = Math.abs((aloc.principal_consumido + aloc.rendimento_bruto) - aloc.valor_bruto_resgatado) <= 0.02;
  const eq2 = Math.abs((aloc.valor_bruto_resgatado - aloc.ir_retido) - aloc.valor_liquido) <= 0.02;
  const eq3 = aloc.ir_retido >= 0;
  return eq1 && eq2 && eq3;
});
assert(todasEquacoesValidas, "Cenário 11: Todas as alocações respeitam estritamente Bruto = Principal + Rendimento e Líquido = Bruto - IR");

// 2. Invariante da Soma: Soma dos líquidos = Total solicitado
assert(
  Math.abs(sim4.valorLiquidoTotal - sim4.valorLiquidoSolicitado) <= 0.01,
  "Cenário 11: Soma dos líquidos da simulação 4 é rigorosamente igual ao solicitado"
);
assert(
  Math.abs(sim5.valorLiquidoTotal - sim5.valorLiquidoSolicitado) <= 0.01,
  "Cenário 11: Soma dos líquidos da simulação 5 é rigorosamente igual ao solicitado"
);

// 3. Invariante FIFO: Nenhum lote mais novo pode ser consumido enquanto houver saldo disponível em lote anterior
const alocacoesSim5 = sim5.alocacoes;
const lote1EsgotadoAntesLote2 = alocacoesSim5[0].isTotalmenteConsumido && alocacoesSim5[0].principal_remanescente_pos === 0;
assert(lote1EsgotadoAntesLote2, "Cenário 11: Invariante FIFO comprovado — Lote 1 foi 100% esgotado antes do Lote 2 ter principal consumido");

// 4. Invariante de Resgate Total: Deve consumir 100% do saldo restante
assert(
  sim7.alocacoes.every(a => a.principal_remanescente_pos === 0),
  "Cenário 11: Invariante Resgate Total — Todos os lotes foram zerados sem deixar principal remanescente"
);

console.log("\n=================================================");
console.log(`TOTAL DE ASSERTIONS: ${totalTests} | PASSARAM: ${passedTests} | FALHARAM: ${totalTests - passedTests}`);
if (passedTests === totalTests) {
  console.log("🎉 TODOS OS 10 CENÁRIOS FORAM VALIDADOS COM 100% DE SUCESSO!");
} else {
  console.error("❌ ALGUNS TESTES FALHARAM!");
  process.exit(1);
}
console.log("=================================================\n");

