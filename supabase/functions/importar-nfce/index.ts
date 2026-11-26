import "jsr:@supabase/functions-js/edge-runtime.d.ts"
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2'
// @ts-ignore
import * as cheerio from 'npm:cheerio'

async function obterCategoriaPorCnpj(supabase: any, userId: string, cnpj: string) {
  console.log("[NFCE] CONSULTANDO MAPEAMENTO");
  const { data: regraCategoria, error: regraError } = await supabase
    .from("nfce_cnpj_categoria")
    .select("categoria_id")
    .eq("user_id", userId)
    .eq("cnpj", cnpj)
    .maybeSingle();

  if (regraError) {
    console.error("[NFCE] ERRO CONSULTANDO MAPEAMENTO:", regraError);
  }

  let categoriaId = undefined;

  if (regraCategoria?.categoria_id) {
    categoriaId = regraCategoria.categoria_id;
  } else {

    // Busca dinâmica pela categoria Supermercado
    const { data: catDefault } = await supabase
      .from("categorias")
      .select("id")
      .ilike("nome", "%supermercado%")
      .maybeSingle();

    if (catDefault?.id) {
      categoriaId = catDefault.id;
    } else {
      console.log("[NFCE] CATEGORIA SUPERMERCADO NAO ENCONTRADA NO BANCO");
    }
  }

  return categoriaId;
}

function isAuthorizedSefazUrl(urlObj: URL): boolean {
  if (urlObj.protocol !== 'https:') {
    return false;
  }
  // Não autorizar portas HTTPS não padrão
  if (urlObj.port && urlObj.port !== '443') {
    return false;
  }

  const hostname = urlObj.hostname.toLowerCase();
  const allowedHosts = new Set([
    'www.nfce.fazenda.sp.gov.br',
    'nfce.fazenda.sp.gov.br',
    'www.fazenda.sp.gov.br',
    'fazenda.sp.gov.br',
    'satsp.fazenda.sp.gov.br'
  ]);

  if (!allowedHosts.has(hostname)) {
    return false;
  }

  const pathname = urlObj.pathname.toLowerCase();
  const isAllowedPath =
    pathname.startsWith('/qrcode') ||
    pathname.startsWith('/nfce/qrcode') ||
    pathname.startsWith('/nfceconsultapublica') ||
    pathname.includes('consultapublicasat') ||
    pathname === '/consulta';

  return isAllowedPath;
}

interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
}

function parseSetCookie(raw: string, currentHost: string): StoredCookie | null {
  const parts = raw.split(';').map(p => p.trim());
  if (parts.length === 0 || !parts[0]) return null;

  const [first, ...rest] = parts;
  const eqIdx = first.indexOf('=');
  if (eqIdx <= 0) return null;

  const name = first.substring(0, eqIdx).trim();
  const value = first.substring(eqIdx + 1).trim();
  if (!name) return null;

  let domain = currentHost.toLowerCase();
  let path = '/';

  for (const part of rest) {
    const [rawAttr, ...valParts] = part.split('=');
    const attr = rawAttr.trim().toLowerCase();
    const val = valParts.join('=').trim();

    if (attr === 'domain' && val) {
      domain = val.startsWith('.') ? val.slice(1).toLowerCase() : val.toLowerCase();
    } else if (attr === 'path' && val) {
      path = val;
    }
  }

  return { name, value, domain, path };
}

function extractSetCookies(headers: Headers): string[] {
  if (typeof (headers as any).getSetCookie === 'function') {
    return (headers as any).getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

function isCookieApplicable(cookie: StoredCookie, targetUrl: URL): boolean {
  const targetHost = targetUrl.hostname.toLowerCase();
  const domainMatches = targetHost === cookie.domain || targetHost.endsWith('.' + cookie.domain);
  if (!domainMatches) return false;

  if (!targetUrl.pathname.startsWith(cookie.path)) return false;

  return true;
}

function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof TypeError) return true;

  const message = String((error as any)?.message ?? error ?? "").toLowerCase();
  return [
    "connection reset",
    "connection refused",
    "network error",
    "failed to fetch",
    "fetch failed",
    "timed out",
    "timeout",
    "econnreset",
    "econnrefused",
    "temporarily unavailable",
    "socket"
  ].some((term) => message.includes(term));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSefazWithRetry(
  targetUrl: string,
  headers: Record<string, string>,
  maxAttempts = 3,
  timeoutMs = 18000
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers,
        redirect: "manual"
      });

      clearTimeout(timeoutId);

      // Retry apenas em indisponibilidade temporária do servidor.
      if ([429, 500, 502, 503, 504].includes(response.status) && attempt < maxAttempts) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 5000)
          : attempt * 1000;

        console.warn(`[NFCE] SEFAZ respondeu HTTP ${response.status}; nova tentativa ${attempt + 1}/${maxAttempts} em ${delayMs}ms.`);
        try { await response.body?.cancel(); } catch { /* libera a conexão quando possível */ }
        await sleep(delayMs);
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      if (!isRetryableNetworkError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const delayMs = attempt * 1000;
      console.warn(`[NFCE] Falha temporária de conexão com a SEFAZ; tentativa ${attempt + 1}/${maxAttempts} em ${delayMs}ms. Tipo: ${error instanceof Error ? error.name : "erro desconhecido"}`);
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Não foi possível estabelecer conexão com a SEFAZ-SP.");
}

async function safeFetchSefaz(initialUrl: string, maxRedirects = 5): Promise<Response> {
  let currentUrl = initialUrl;
  const cookieJar = new Map<string, StoredCookie>();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = new URL(currentUrl);
    if (!isAuthorizedSefazUrl(u)) {
      throw new Error("URL ou destino não autorizado para consulta fiscal.");
    }

    const requestHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (compatible; EasyFinanceSuite/1.0; NFCe-Consulta)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9"
    };

    const applicableCookies = Array.from(cookieJar.values())
      .filter(c => isCookieApplicable(c, u))
      .map(c => `${c.name}=${c.value}`);

    if (applicableCookies.length > 0) {
      requestHeaders["Cookie"] = applicableCookies.join("; ");
    }

    const resp = await fetchSefazWithRetry(currentUrl, requestHeaders);

    const setCookies = extractSetCookies(resp.headers);
    for (const rawSc of setCookies) {
      const parsed = parseSetCookie(rawSc, u.hostname);
      if (parsed) cookieJar.set(`${parsed.domain}:${parsed.name}`, parsed);
    }

    if ([301, 302, 303, 307, 308].includes(resp.status)) {
      const location = resp.headers.get("location");
      if (!location) {
        throw new Error(`Resposta de redirecionamento (${resp.status}) sem cabeçalho Location.`);
      }

      const nextUrlObj = new URL(location, currentUrl);
      if (!isAuthorizedSefazUrl(nextUrlObj)) {
        throw new Error("Redirecionamento para destino não autorizado.");
      }

      currentUrl = nextUrlObj.toString();
      continue;
    }

    return resp;
  }

  throw new Error("Limite máximo de redirecionamentos excedido.");
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // Diagnóstico temporário: identifica a região onde a Edge Function está executando.

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Método não permitido." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405
    });
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error("Missing Authorization header")
    }

    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    // @ts-ignore
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuração do Supabase ausente na Edge Function.");
    }
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error("Unauthorized")
    }

    const body = await req.json()
    const url = body.url

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL não fornecida." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "URL inválida ou malformada." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!isAuthorizedSefazUrl(urlObj)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `URL não autorizada para consulta fiscal: ${urlObj.origin}. Apenas hosts e rotas oficiais da SEFAZ-SP sob HTTPS na porta padrão são aceitos.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Extrai chave de acesso (44 dígitos obrigatórios)
    const chave_acesso_param = urlObj.searchParams.get('p') || url;
    const chaveMatch = chave_acesso_param.match(/\d{44}/);
    if (!chaveMatch) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Chave de acesso de 44 dígitos da NFC-e não encontrada na URL informada."
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    const chave_acesso = chaveMatch[0];

    console.log("[NFCE] Início da importação autenticada.");

    // Check duplicate
    console.log("[NFCE] Verificando duplicidade.");
    const { data: duplicate, error: duplicateError } = await supabase
      .from('nfce_compras')
      .select('id')
      .eq('user_id', user.id)
      .eq('chave_acesso', chave_acesso)
      .maybeSingle();

    if (duplicateError) {
      console.error("[NFCE] Falha ao verificar duplicidade:", duplicateError.message);
      throw new Error("Não foi possível verificar se a NFC-e já foi importada.");
    }

    if (duplicate) {
      return new Response(
        JSON.stringify({
          success: false,
          duplicada: true,
          message: "Nota fiscal já importada anteriormente."
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    let response: Response;
    try {
      response = await safeFetchSefaz(url);
      console.log("FETCH OK");
      console.log("STATUS:", response.status);
    } catch (e: any) {
      console.error("[NFCE] Consulta à SEFAZ falhou após as tentativas:", {
        name: e?.name ?? "Error",
        message: e?.message ?? String(e)
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Não foi possível consultar a SEFAZ-SP após algumas tentativas. Aguarde alguns instantes e tente novamente."
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    if (!response.ok) {
      console.warn(`[NFCE] SEFAZ respondeu com status HTTP inesperado: ${response.status}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `O servidor da SEFAZ-SP retornou o status HTTP ${response.status}. A consulta fiscal não pôde ser concluída.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    const html = await response.text();
    if (!html) {
      return new Response(
        JSON.stringify({ success: false, error: "A resposta HTML da SEFAZ está vazia." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Detecção explícita de bloqueio de WAF / Firewall da SEFAZ-SP (ex: F5 BIG-IP ASM "Request Rejected")
    const isWafRejected =
      html.includes('<title>Request Rejected</title>') ||
      html.toLowerCase().includes('the requested url was rejected') ||
      html.toLowerCase().includes('support id is:');

    if (isWafRejected) {
      console.warn("[NFCE] Resposta de bloqueio do firewall da SEFAZ-SP detectada (Request Rejected)");
      return new Response(
        JSON.stringify({
          success: false,
          error: "A consulta da NFC-e foi bloqueada pela infraestrutura de segurança da SEFAZ-SP (Request Rejected). Tente novamente em instantes."
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    console.log("CHECKPOINT 1");
    let $: any;
    try {
      console.log("ANTES CHEERIO");
      $ = cheerio.load(html);
      console.log("DEPOIS CHEERIO");
      console.log("CHEERIO LOAD OK");
    } catch (err) {
      console.error("CHEERIO LOAD ERROR", err);
      throw err;
    }
    console.log("CHECKPOINT 2");
    console.log("HTML SIZE:", html.length);

    // Confirmação de marcadores confiáveis da SEFAZ-SP no HTML
    const temMarcadorEstrutural =
      $('#tabResult').length > 0 ||
      $('#linhaTotal').length > 0 ||
      $('.txtMax').length > 0 ||
      $('.txtTopo').length > 0 ||
      $('#conteudo').length > 0;

    const htmlLower = html.toLowerCase();
    const temTermoFiscalSefaz =
      htmlLower.includes('nfc-e') ||
      htmlLower.includes('danfe') ||
      htmlLower.includes('fazenda') ||
      htmlLower.includes('secretaria da fazenda');

    if (!temMarcadorEstrutural || !temTermoFiscalSefaz) {
      console.warn("[NFCE] Conteúdo retornado não apresenta os marcadores esperados da SEFAZ-SP");
      return new Response(
        JSON.stringify({
          success: false,
          error: "O conteúdo retornado não corresponde a uma página de consulta fiscal esperada da SEFAZ-SP."
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
      );
    }

    console.log("ANTES PAGETEXT");
    const pageText = $('body').text().toLowerCase();
    console.log("DEPOIS PAGETEXT");
    console.log("CHECKPOINT 3");
    console.log("ANTES CANCELADA CHECK");
    try {
      console.log("VALIDANDO STATUS DA NOTA");

      const bodyClone = $('body').clone();
      bodyClone.find('script, style').remove();
      const visibleText = bodyClone.text().toLowerCase();

      const canceladaDetectada = visibleText.includes('nfc-e cancelada') || visibleText.includes('nota cancelada');
      const denegadaDetectada = visibleText.includes('uso denegado') || visibleText.includes('denegada');
      const inutilizadaDetectada = visibleText.includes('inutilizada');
      const verificationDetectada = visibleText.includes('verificando disponibilidade') ||
        visibleText.includes('verificação de segurança') ||
        visibleText.includes('não foi possível localizar') ||
        visibleText.includes('nota fiscal não encontrada');

      console.log("CANCELADA VISIVEL:", canceladaDetectada);
      console.log("DENEGADA VISIVEL:", denegadaDetectada);
      console.log("INUTILIZADA VISIVEL:", inutilizadaDetectada);

      if (
        canceladaDetectada ||
        denegadaDetectada ||
        inutilizadaDetectada
      ) {
        console.log("ENTROU BLOCO CANCELADA");
        return new Response(
          JSON.stringify({
            success: false,
            cancelada: true,
            message: "NFC-e cancelada ou inválida."
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      if (verificationDetectada) {
        console.warn("[NFCE] Página de verificação ou indisponibilidade detectada");
        return new Response(
          JSON.stringify({
            success: false,
            error: "A consulta da SEFAZ retornou uma página de verificação, indisponibilidade ou a nota não foi encontrada."
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
        );
      }
    } catch (err) {
      console.error("ERRO BLOCO CANCELADA:", err);
      throw err;
    }
    console.log("DEPOIS CANCELADA CHECK");

    console.log("PASSOU CANCELADA CHECK");

    console.log("ANTES ESTABELECIMENTO");

    // FASE 1 - Extrair informações principais
    console.log("EXTRAINDO ESTABELECIMENTO");
    let estabelecimento = $('.txtTopo').first().text().trim() || $('[id^="u"]').first().text().trim();
    if (!estabelecimento) estabelecimento = "Estabelecimento Não Identificado";

    console.log("EXTRAINDO CNPJ");
    let cnpjText = $('.text').filter((_: any, el: any) => $(el).text().includes('CNPJ')).text();
    const cnpjMatch = cnpjText.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) || cnpjText.match(/\d{14}/);
    const cnpj = cnpjMatch ? cnpjMatch[0] : "";

    // Resolvendo categoria baseada no CNPJ do usuário autenticado (isolamento multiusuário)
    const categoria_id = await obterCategoriaPorCnpj(supabase, user.id, cnpj);

    console.log("EXTRAINDO DATA");
    let dataText = $('strong').filter((_: any, el: any) => $(el).text().includes('Emissão')).parent().text();
    let dateMatch = dataText.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
    if (!dateMatch) {
      // Fallback de extração no texto do corpo se a estrutura de tags variar ligeiramente
      dateMatch = pageText.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
    }

    if (!dateMatch) {
      console.warn("[NFCE] Data de emissão não encontrada na página da SEFAZ-SP");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Não foi possível extrair a data de emissão oficial da nota fiscal na página da SEFAZ-SP."
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
      );
    }

    const dia = parseInt(dateMatch[1], 10);
    const mes = parseInt(dateMatch[2], 10);
    const ano = parseInt(dateMatch[3], 10);
    const hora = parseInt(dateMatch[4], 10);
    const minuto = parseInt(dateMatch[5], 10);
    const segundo = parseInt(dateMatch[6], 10);

    if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 2015 || ano > 2035 || hora > 23 || minuto > 59 || segundo > 59) {
      console.warn("[NFCE] Data de emissão extraída com valores inválidos:", dateMatch[0]);
      return new Response(
        JSON.stringify({
          success: false,
          error: "A data de emissão extraída da nota fiscal é inválida."
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
      );
    }

    const data_compra = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}-03:00`;

    console.log("EXTRAINDO VALOR");
    let valorText = $('.txtMax').text().trim() || $('#linhaTotal .totalNumb').text().trim();
    if (!valorText) {
      const matchValor = html.match(/Valor a pagar[\s\S]*?(\d+,\d{2})/i);
      if (matchValor) valorText = matchValor[1];
    }
    console.log("ANTES PARSE VALOR");
    let valor_total = parseFloat(valorText.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;

    console.log("ANTES FORMA PAGAMENTO");
    let forma_pagamento = "Dinheiro"; // default
    let paymentText = $('#linhaFormaPagamento').text().toLowerCase() || $('.tx').text().toLowerCase() || $('#conteudo').text().toLowerCase();

    if (paymentText.includes('cartão') || paymentText.includes('cartao') || paymentText.includes('crédito') || paymentText.includes('debito') || paymentText.includes('credito') || paymentText.includes('cartao de credito') || paymentText.includes('cartão de crédito')) {
      forma_pagamento = "Cartão Crédito";
    } else if (paymentText.includes('pix')) {
      forma_pagamento = "PIX";
    } else if (paymentText.includes('dinheiro') || paymentText.includes('vale') || paymentText.includes('alimentação') || paymentText.includes('alimentacao') || paymentText.includes('refeição') || paymentText.includes('refeicao')) {
      forma_pagamento = "Dinheiro";
    } else {
      forma_pagamento = "Dinheiro";
    }
    console.log("DEPOIS PAGAMENTO", forma_pagamento);

    let numero_parcelas = 1;
    const paymentArea = $('#linhaFormaPagamento').text();
    let parcelasMatch: any = null;

    if (forma_pagamento === "Cartão Crédito") {
      parcelasMatch = paymentArea.match(/(\d+)\s*x/i) || paymentArea.match(/(\d+)\s*parcelas/i);
      if (parcelasMatch) {
        const parcelas = parseInt(parcelasMatch[1]);
        if (parcelas > 1 && parcelas <= 36) {
          numero_parcelas = parcelas;
        }
      }
    }

    console.log("PARCELAS DEFINIDAS:", numero_parcelas);

    console.log("ANTES PRODUTOS");
    // FASE 2 - Extrair Produtos
    const produtos: any[] = [];
    $('#tabResult tr').each((_: any, el: any) => {
      const descricao = $(el).find('.txtTit').text().trim();
      const codigo_barras = $(el).find('.RCod').text().replace(/[^0-9]/g, '').trim();
      const quantidadeText = $(el).find('.Rqtd').text().replace(/[a-zA-Z:\s]/g, '').replace(',', '.').trim();
      const quantidade = parseFloat(quantidadeText) || 1;
      const unidade = $(el).find('.RUN').text().replace(/[^a-zA-Z]/g, '').replace('UN', 'UN').trim() || "UN";
      const valorUnitarioText = $(el).find('.RvlUnit').text().replace(/[^0-9,]/g, '').replace(',', '.').trim();
      const valor_unitario = parseFloat(valorUnitarioText) || 0;
      const valorTotalText = $(el).find('.valor').text().replace(/[^0-9,]/g, '').replace(',', '.').trim();
      const valor_total_item = parseFloat(valorTotalText) || (quantidade * valor_unitario);

      if (descricao) {
        produtos.push({
          descricao,
          codigo_barras,
          quantidade,
          unidade,
          valor_unitario,
          valor_total: valor_total_item
        });
      }
    });

    if (valor_total === 0 && produtos.length > 0) {
      valor_total = produtos.reduce((acc, item) => acc + item.valor_total, 0);
    }

    console.log("CNPJ:", cnpj);
    console.log("PRODUTOS:", produtos.length);

    // Validação dos dados extraídos:
    // Se o estabelecimento não for identificado, CNPJ vazio, não houver produtos e o valor total for zero,
    // não insere o registro e retorna erro claro.
    const isDadosVazios = (!estabelecimento || estabelecimento === "Estabelecimento Não Identificado") &&
      !cnpj &&
      produtos.length === 0 &&
      valor_total === 0;

    const isDadosPlausíveis = Boolean(cnpj) && (valor_total > 0 || produtos.length > 0) && estabelecimento && estabelecimento !== "Estabelecimento Não Identificado";

    if (isDadosVazios || !isDadosPlausíveis) {
      console.warn("[NFCE] Dados fiscais incompletos ou página incompatível com o padrão da SEFAZ-SP");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Não foi possível extrair os dados da NFC-e da página retornada pela SEFAZ. Verifique se a nota é válida e está disponível para consulta pública."
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
      );
    }

    // Salvar no Banco
    console.log("NFCE PARCELAS EXTRAIDAS:", numero_parcelas);
    console.log("ANTES INSERT COMPRA");
    console.log("INSERINDO COMPRA");
    console.log('[NFCE] VAI INSERIR COMPRA');
    const { data: compra, error: compraError } = await supabase
      .from('nfce_compras')
      .insert({
        user_id: user.id,
        chave_acesso,
        url_nfce: response.url || url,
        estabelecimento,
        cnpj,
        data_compra,
        valor_total,
        forma_pagamento,
        numero_parcelas,
        raw_html: html.substring(0, 200000),
        status_importacao: 'pendente'
      })
      .select()
      .single()

    console.log('[NFCE] INSERT RETORNOU');

    if (compraError) {
      // Trata concorrência: duas requisições podem consultar duplicidade ao mesmo tempo.
      if (compraError.code === "23505") {
        return new Response(JSON.stringify({
          success: false,
          duplicada: true,
          message: "Esta NFC-e já foi importada anteriormente."
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }
      console.error("[NFCE] Erro ao inserir compra:", compraError.message, compraError.code);
      throw new Error("Não foi possível salvar os dados principais da NFC-e.");
    }

    console.log("[NFCE] Compra inserida:", compra?.id);

    if (produtos.length > 0) {
      const itensToInsert = produtos.map(p => ({
        compra_id: compra.id,
        ...p
      }));
      console.log("INSERINDO ITENS:", itensToInsert.length);
      const { error: itensError } = await supabase.from('nfce_itens').insert(itensToInsert);
      if (itensError) {
        console.error("[NFCE] Erro ao inserir itens:", itensError.message, itensError.code);

        // Evita deixar uma compra aparentemente importada sem seus produtos.
        const { error: rollbackError } = await supabase
          .from('nfce_compras')
          .delete()
          .eq('id', compra.id)
          .eq('user_id', user.id);

        if (rollbackError) {
          console.error("[NFCE] Falha ao remover compra incompleta:", rollbackError.message);
        }

        throw new Error("A compra foi identificada, mas não foi possível salvar todos os produtos. Tente importar novamente.");
      }
      console.log("[NFCE] Itens inseridos:", itensToInsert.length);
    }

    console.log("[NFCE] Importação concluída:", {
      quantidadeProdutos: produtos.length,
      valorTotalValidado: valor_total > 0
    });

    const result = {
      success: true,
      compra,
      produtos,
      categoria_id,
      quantidadeProdutos: produtos.length
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[NFCE] Erro não tratado:", {
      name: error?.name ?? "Error",
      message: error?.message ?? String(error),
      code: error?.code ?? null
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: "Ocorreu um erro interno ao importar a NFC-e. Tente novamente em alguns instantes."
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})
