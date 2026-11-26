/**
 * Módulo de Gerenciamento de Idempotência e Reconciliação de Investimentos (RISK-01)
 * 
 * Garante que:
 * 1. Cada tentativa de cadastro tenha uma chave UUID persistida no localStorage por usuário.
 * 2. Em caso de timeout de rede, F5 ou perda de sessão, o mesmo payload e chave sejam recuperados.
 * 3. Tentativas ambíguas sejam reconciliadas ou canceladas com segurança através das RPCs.
 */

// Lazy dynamic import of supabase client to allow pure test environments without Vite/browser context
async function getSupabase() {
  const mod = await import("@/integrations/supabase/client");
  return mod.supabase;
}

export interface PendingInvestmentAttempt {
  idempotencyKey: string;
  userId: string;
  payload: {
    nome: string;
    tipo: string;
    valor: number;
    data: string;
    data_vencimento: string | null;
    tipo_rentabilidade: string;
    indexador: string | null;
    percentual_indexador: number | null;
    taxa_fixa: number | null;
    origem_investimento: string;
  };
  payloadHash: string;
  status: "submitting" | "ambiguous_timeout" | "validation_error";
  createdAt: number;
}

export function computePayloadHash(payload: PendingInvestmentAttempt["payload"]): string {
  const normalized = [
    (payload.nome || "").trim(),
    (payload.tipo || "").trim(),
    Number(payload.valor || 0).toFixed(2),
    payload.data,
    payload.data_vencimento || "",
    payload.tipo_rentabilidade,
    payload.indexador || "",
    payload.percentual_indexador !== null && payload.percentual_indexador !== undefined ? String(payload.percentual_indexador) : "",
    payload.taxa_fixa !== null && payload.taxa_fixa !== undefined ? String(payload.taxa_fixa) : "",
    payload.origem_investimento || "saldo_atual"
  ].join("|");
  return normalized;
}

export function getStorageKey(userId: string): string {
  return `investimento_pending_attempt_${userId}`;
}

export function loadPendingAttempt(userId: string): PendingInvestmentAttempt | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingInvestmentAttempt;
    if (parsed.userId !== userId || !parsed.idempotencyKey) return null;
    return parsed;
  } catch (e) {
    console.warn("Erro ao carregar tentativa pendente de investimento:", e);
    return null;
  }
}

export function savePendingAttempt(attempt: PendingInvestmentAttempt): void {
  if (!attempt.userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(attempt.userId), JSON.stringify(attempt));
  } catch (e) {
    console.warn("Erro ao salvar tentativa pendente de investimento:", e);
  }
}

export function clearPendingAttempt(userId: string): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.removeItem(getStorageKey(userId));
  } catch (e) {
    console.warn("Erro ao limpar tentativa pendente de investimento:", e);
  }
}

/**
 * Consulta no servidor o status real da operação pendente.
 */
export async function consultarOperacaoServidor(idempotencyKey: string) {
  const supabase = await getSupabase();
  const { data, error } = await (supabase.rpc as any)("consultar_operacao_investimento", {
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  return data;
}

/**
 * Cancela com segurança no servidor uma operação ainda não concluída.
 */
export async function cancelarOperacaoServidor(idempotencyKey: string) {
  const supabase = await getSupabase();
  const { data, error } = await (supabase.rpc as any)("cancelar_operacao_investimento", {
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  return data;
}
