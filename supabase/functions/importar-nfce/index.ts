import "jsr:@supabase/functions-js/edge-runtime.d.ts"
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const url = body.url

    if (!url) {
      console.error("Erro: URL não enviada.")
      return new Response(
        JSON.stringify({ success: false, error: "URL não fornecida." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log(`Iniciando fetch para a URL: ${url}`)

    let response: Response;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
        const fetchOptions: RequestInit = {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "pt-BR,pt;q=0.9"
            },
            redirect: "follow"
        };
        response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
    } catch (e: any) {
        console.error("Erro no fetch (Timeout, DNS, etc):", e);
        return new Response(
            JSON.stringify({ success: false, error: `Falha ao buscar URL: ${e.message}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }

    const finalUrl = response.url;
    const status = response.status;
    const contentType = response.headers.get("content-type") || "unknown";
    
    console.log("URL original:", url);
    console.log("URL final:", finalUrl);
    console.log("Status:", status);
    console.log("Content-Type:", contentType);

    const html = await response.text();
    
    if (!html) {
        console.error("Erro: HTML retornado vazio.");
        return new Response(
            JSON.stringify({ success: false, error: "A resposta HTML está vazia." }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }

    const htmlLength = html.length;
    const preview = html.substring(0, 1000);
    
    console.log("Tamanho HTML:", htmlLength);
    
    const result = {
      success: true,
      status,
      finalUrl,
      contentType,
      htmlLength,
      preview
    };

    console.log("Retornando sucesso:", result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("Erro geral na Edge Function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
