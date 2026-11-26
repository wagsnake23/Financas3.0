/**
 * Módulo Centralizado de Cálculo do Caixa Atual
 * 
 * Regra Financeira:
 * Caixa Atual = Receitas Recebidas - Despesas Pagas - Capital Principal Retido + Rendimento Líquido Realizado + Saldo de Ajuste Manual
 * 
 * SSOT para:
 * - Home.tsx
 * - Dashboard.tsx
 * - SaldoAjusteDialog.tsx
 */

export interface InvestimentoLike {
  id: string;
  status?: string | null;
  origem_investimento?: string | null;
  valor?: number | null;
  [key: string]: any;
}

export interface AporteLike {
  id?: string;
  investimento_id: string;
  valor_original?: number | null;
  [key: string]: any;
}

export interface AlocacaoResgateLike {
  id?: string;
  resgate_id?: string;
  aporte_id?: string;
  investimento_id: string;
  principal_consumido?: number | null;
  valor_liquido?: number | null;
  rendimento_bruto?: number | null;
  ir_retido?: number | null;
  is_legado?: boolean | null;
  [key: string]: any;
}

export interface CalcularCaixaAtualParams {
  globalReceivedIncome: number;
  globalPaidExpenses: number;
  investimentos: InvestimentoLike[];
  aportes: AporteLike[];
  alocacoesResgates: AlocacaoResgateLike[];
  saldoAjusteManual?: number | null;
}

export interface CaixaAtualResultado {
  /** Capital principal de investimentos de 'saldo_atual' que ainda permanece retido em aplicações ativas */
  capitalPrincipalRetido: number;
  /** Rendimento líquido total já realizado em resgates de investimentos originados do 'saldo_atual' (valor_liquido - principal_consumido) */
  rendimentoLiquidoRealizado: number;
  /** Saldo calculado do sistema: (Receitas - Despesas - CapitalRetido + RendimentoLiquido) */
  saldoCalculadoSistema: number;
  /** Saldo final de Caixa Atual incorporando o ajuste manual: (saldoCalculadoSistema + saldoAjusteManual) */
  caixaAtualFinal: number;
}

/**
 * Calcula o Capital Principal Retido em investimentos com origem 'saldo_atual'.
 * Considera apenas investimentos ativos ou sem status definido.
 * Utiliza histórico de aportes e principal consumido nas alocações FIFO quando houver aportes;
 * caso contrário, retrocompatibilidade com investimento.valor para investimentos legados.
 */
export function calcularCapitalPrincipalRetido(
  investimentos: InvestimentoLike[],
  aportes: AporteLike[],
  alocacoesResgates: AlocacaoResgateLike[]
): number {
  const activeSaldoAtualInvIds = new Set(
    (investimentos || [])
      .filter((inv) => (inv.status === 'ativo' || !inv.status) && inv.origem_investimento === 'saldo_atual')
      .map((inv) => inv.id)
  );

  if (activeSaldoAtualInvIds.size === 0) {
    return 0;
  }

  if (aportes && aportes.length > 0) {
    const totalAportesAtivos = aportes
      .filter((ap) => activeSaldoAtualInvIds.has(ap.investimento_id))
      .reduce((sum, ap) => sum + (Number(ap.valor_original) || 0), 0);

    const totalPrincipalConsumidoAtivos = alocacoesResgates
      .filter((aloc) => activeSaldoAtualInvIds.has(aloc.investimento_id))
      .reduce((sum, aloc) => sum + (Number(aloc.principal_consumido) || 0), 0);

    return Math.max(0, totalAportesAtivos - totalPrincipalConsumidoAtivos);
  }

  // Fallback para investimentos legados sem aportes registrados na tabela de aportes
  return (investimentos || [])
    .filter((inv) => (inv.status === 'ativo' || !inv.status) && inv.origem_investimento === 'saldo_atual')
    .reduce((sum, inv) => sum + (Number(inv.valor) || 0), 0);
}

/**
 * Calcula o Rendimento Líquido Realizado total dos resgates de investimentos
 * cuja origem foi 'saldo_atual'.
 * 
 * Regras obrigatórias:
 * 1. Considera todos os investimentos com origem_investimento === 'saldo_atual' (inclusive os já com status 'resgatado').
 * 2. Rendimento líquido de cada alocação = (valor_liquido - principal_consumido).
 * 3. NÃO utiliza Math.max(0, ...) nesta operação, preservando eventual prejuízo real.
 * 4. Alocações legadas (is_legado = true) têm valor_liquido = principal_consumido (rendimento = 0).
 * 5. Ignora investimentos de origem 'caixa_externo'.
 */
export function calcularRendimentoLiquidoRealizado(
  investimentos: InvestimentoLike[],
  alocacoesResgates: AlocacaoResgateLike[]
): number {
  const saldoAtualInvIds = new Set(
    (investimentos || [])
      .filter((inv) => inv.origem_investimento === 'saldo_atual')
      .map((inv) => inv.id)
  );

  if (saldoAtualInvIds.size === 0 || !alocacoesResgates || alocacoesResgates.length === 0) {
    return 0;
  }

  return alocacoesResgates
    .filter((aloc) => saldoAtualInvIds.has(aloc.investimento_id))
    .reduce((sum, aloc) => {
      const vLiquido = Number(aloc.valor_liquido) || 0;
      const pConsumido = Number(aloc.principal_consumido) || 0;
      const rendimentoLiquidoAloc = vLiquido - pConsumido;
      return sum + rendimentoLiquidoAloc;
    }, 0);
}

/**
 * Função mestre centralizada para calcular o Caixa Atual.
 */
export function calcularCaixaAtual({
  globalReceivedIncome,
  globalPaidExpenses,
  investimentos,
  aportes,
  alocacoesResgates,
  saldoAjusteManual = 0,
}: CalcularCaixaAtualParams): CaixaAtualResultado {
  const capitalPrincipalRetido = calcularCapitalPrincipalRetido(
    investimentos,
    aportes,
    alocacoesResgates
  );

  const rendimentoLiquidoRealizado = calcularRendimentoLiquidoRealizado(
    investimentos,
    alocacoesResgates
  );

  const saldoCalculadoSistema =
    (globalReceivedIncome || 0) -
    (globalPaidExpenses || 0) -
    capitalPrincipalRetido +
    rendimentoLiquidoRealizado;

  const caixaAtualFinal = saldoCalculadoSistema + (Number(saldoAjusteManual) || 0);

  return {
    capitalPrincipalRetido,
    rendimentoLiquidoRealizado,
    saldoCalculadoSistema,
    caixaAtualFinal,
  };
}
