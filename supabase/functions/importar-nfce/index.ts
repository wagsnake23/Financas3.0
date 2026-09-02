import "jsr:@supabase/functions-js/edge-runtime.d.ts"
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2'
// @ts-ignore
import * as cheerio from 'npm:cheerio'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    // Extract access key (chave_acesso) from URL
    const urlObj = new URL(url);
    const chave_acesso_param = urlObj.searchParams.get('p') || url;
    const chaveMatch = chave_acesso_param.match(/\d{44}/);
    const chave_acesso = chaveMatch ? chaveMatch[0] : chave_acesso_param;

    console.log("INICIO FUNCAO");
    console.log("USER:", user?.id);
    console.log("URL:", url);
    console.log("CHAVE:", chave_acesso);

    // Check duplicate
    const { data: duplicate } = await supabase
      .from('nfce_compras')
      .select('id')
      .eq('chave_acesso', chave_acesso)
      .maybeSingle()
      
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const fetchOptions: RequestInit = {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "pt-BR,pt;q=0.9"
            },
            redirect: "follow"
        };
        try {
            response = await fetch(url, fetchOptions);
            console.log("FETCH OK");
            console.log("STATUS:", response.status);
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (e: any) {
        return new Response(
            JSON.stringify({ success: false, error: `Falha ao buscar URL: ${e.message}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }

    const html = await response.text();
    if (!html) {
        return new Response(
            JSON.stringify({ success: false, error: "A resposta HTML está vazia." }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }

    console.log("CHECKPOINT 1");
    let $: any;
    try {
      $ = cheerio.load(html);
      console.log("CHEERIO LOAD OK");
    } catch(err) {
      console.error("CHEERIO LOAD ERROR", err);
      throw err;
    }
    console.log("CHECKPOINT 2");
    console.log("HTML SIZE:", html.length);

    const pageText = $('body').text().toLowerCase();
    console.log("CHECKPOINT 3");
    if (pageText.includes('cancelada') || pageText.includes('denegada') || pageText.includes('inutilizada')) {
        return new Response(
            JSON.stringify({
                success: false,
                cancelada: true,
                message: "NFC-e cancelada ou inválida."
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    }

    // FASE 1 - Extrair informações principais
    let estabelecimento = $('.txtTopo').first().text().trim() || $('[id^="u"]').first().text().trim();
    console.log("CHECKPOINT 4");
    if (!estabelecimento) estabelecimento = "Estabelecimento Não Identificado";
    
    let cnpjText = $('.text').filter((_: any, el: any) => $(el).text().includes('CNPJ')).text();
    console.log("CHECKPOINT 5");
    const cnpjMatch = cnpjText.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) || cnpjText.match(/\d{14}/);
    const cnpj = cnpjMatch ? cnpjMatch[0] : "";

    let dataText = $('strong').filter((_: any, el: any) => $(el).text().includes('Emissão')).parent().text();
    const dateMatch = dataText.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
    let data_compra = new Date().toISOString();
    if (dateMatch) {
      data_compra = new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}`).toISOString();
    }

    let valorText = $('.txtMax').text().trim() || $('#linhaTotal .totalNumb').text().trim();
    console.log("CHECKPOINT 6");
    if (!valorText) {
        const matchValor = html.match(/Valor a pagar[\s\S]*?(\d+,\d{2})/i);
        if (matchValor) valorText = matchValor[1];
    }
    let valor_total = parseFloat(valorText.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;

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

    let numero_parcelas = 1;
    const parcelasMatch = html.match(/(\d+)\s*x/i) || html.match(/(\d+)\s*parcelas/i);
    if (parcelasMatch && parseInt(parcelasMatch[1]) > 0) {
        numero_parcelas = parseInt(parcelasMatch[1]);
    }

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

    console.log("ESTABELECIMENTO:", estabelecimento);
    console.log("CNPJ:", cnpj);
    console.log("DATA:", data_compra);
    console.log("VALOR:", valor_total);
    console.log("FORMA PAGAMENTO:", forma_pagamento);
    console.log("PARCELAS:", numero_parcelas);
    console.log("PRODUTOS:", produtos.length);

    // Salvar no Banco
    console.log("INSERINDO COMPRA");
    const { data: compra, error: compraError } = await supabase
      .from('nfce_compras')
      .insert({
          user_id: user.id,
          chave_acesso,
          url_nfce: response.url,
          estabelecimento,
          cnpj,
          data_compra,
          valor_total,
          forma_pagamento,
          numero_parcelas,
          raw_html: html.substring(0, 200000)
      })
      .select()
      .single()

    if (compraError) {
      console.error("POSTGRES ERROR:", JSON.stringify(compraError, null, 2));
      throw new Error(JSON.stringify(compraError));
    }

    console.log("COMPRA INSERIDA:", compra?.id);

    if (produtos.length > 0) {
        const itensToInsert = produtos.map(p => ({
            compra_id: compra.id,
            ...p
        }));
        console.log("INSERINDO ITENS:", itensToInsert.length);
        const { error: itensError } = await supabase.from('nfce_itens').insert(itensToInsert);
        if (itensError) {
            console.error("Erro ao inserir itens:", itensError);
        }
        console.log("ITENS INSERIDOS");
    }

    console.log({
      estabelecimento,
      cnpj,
      data_compra,
      valor_total,
      forma_pagamento,
      numero_parcelas,
      quantidadeProdutos: produtos.length
    });

    const result = {
      success: true,
      compra,
      produtos,
      quantidadeProdutos: produtos.length
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("Erro geral na Edge Function:", error);
    console.error(
      "ERRO COMPLETO:",
      error,
      error?.stack,
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
