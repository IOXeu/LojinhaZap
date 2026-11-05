
/**
 * WORKER PRINCIPAL - LOJINHA ZAP
 * Responsável por: Receber capturas, Limpar/Injetar Links, Salvar no D1 e Entregar Ofertas
 */

export default {
  // Roteador principal de requisições HTTP
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Rota 1: Receber dados do Tampermonkey (POST)
    if (pathname === '/api/achadinhos' && request.method === 'POST') {
      return await handleAchadinhos(request, env);
    }

    // Rota 2: Entregar ofertas para o Site/Painel (GET)
    if (pathname === '/api/ofertas' && request.method === 'GET') {
      return await handleOfertas(env);
    }

    // Rota 3: Health Check (Teste de vida)
    if (pathname === '/') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        service: 'Lojinha Zap Worker',
        timestamp: new Date().toISOString() 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Rota Padrão: 404
    return new Response(JSON.stringify({ error: 'Rota não encontrada' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  },

  // Gatilho Cron (Limpeza automática agendada)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  }
};

// ============================================================================
// FUNÇÃO 1: RECEBER E PROCESSAR NOVAS OFERTAS
// ============================================================================
async function handleAchadinhos(request, env) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data = await request.json();
    const { plataforma, url_original, texto_bruto, imagem_url } = data;

    // Validação básica
    if (!plataforma || !url_original) {
      return new Response(JSON.stringify({ erro: "Dados incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- LÓGICA DE LIMPEZA E INJEÇÃO DE AFILIADOS ---
    let linkFinal = url_original;
    
    // Configurações das suas lojas oficiais
    const SHOPEE_LOJA = "18338650355";
    const MAGALU_LOJA = "https://www.magazinevoce.com.br/magazinehdmicroloja";
    const ML_LOJA = "https://lista.mercadolivre.com.br/_CustId_ML202408011903400660";
    const AMAZON_TAG = "coloposte-20";

    try {
      const urlObj = new URL(url_original);
      const domain = urlObj.hostname.toLowerCase();
      const path = urlObj.pathname;

      // Shopee: Injeta na sua loja oficial mantendo ID do produto
      if (domain.includes('shopee') || domain.includes('shp.ee') || domain.includes('collshp')) {
        const match = path.match(/i\.(\d+)\.(\d+)/);
        linkFinal = match 
          ? `${SHOPEE_LOJA.split('?')[0]}/i.${match[1]}.${match[2]}` 
          : SHOPEE_LOJA;
      } 
      // Mercado Livre: Força link blindado do CustId
      else if (domain.includes('mercadolivre') || domain.includes('mlb.io') || domain.includes('meli.la')) {
        linkFinal = ML_LOJA;
      } 
      // Magalu: Link base da microloja
      else if (domain.includes('magazinevoce') || domain.includes('maga.lu')) {
        linkFinal = MAGALU_LOJA;
      } 
      // Amazon: Garante tag de afiliado
      else if (domain.includes('amazon')) {
        urlObj.searchParams.set('tag', AMAZON_TAG);
        linkFinal = urlObj.toString();
      } 
      // Outros: Passa link original limpo (sem UTM/rastreamento)
      else {
        urlObj.search = '';
        linkFinal = urlObj.toString();
      }
    } catch (e) {
      console.error("Erro ao processar URL:", e);
      linkFinal = url_original; // Fallback seguro
    }

    // --- SALVAMENTO NO BANCO D1 ---
    const now = new Date().toISOString();
    
    if (plataforma === "mercado_livre") {
      await env.DB.prepare(
        "INSERT INTO mercado_livre (url_original, texto_bruto, imagem_url, data_captura) VALUES (?, ?, ?, ?)"
      ).bind(linkFinal, texto_bruto || '', imagem_url || null, now).run();
    } else {
      await env.DB.prepare(
        "INSERT INTO achadinhos (plataforma, url_original, texto_bruto, imagem_url, data_captura) VALUES (?, ?, ?, ?, ?)"
      ).bind(plataforma, linkFinal, texto_bruto || '', imagem_url || null, now).run();
    }

    return new Response(JSON.stringify({ 
      status: "sucesso", 
      mensagem: "Oferta salva e processada!",
      link_final: linkFinal 
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Erro crítico no Worker:", err);
    return new Response(JSON.stringify({ erro: "Falha interna no servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}

// ============================================================================
// FUNÇÃO 2: ENTREGAR LISTA DE OFERTAS (PARA SITE E PAINEL)
// ============================================================================
async function handleOfertas(env) {
  const corsHeaders = { 
    'Access-Control-Allow-Origin': '*', 
    'Content-Type': 'application/json' 
  };

  try {
    let allResults = [];

    // Busca tabela geral
    try {
      const res1 = await env.DB.prepare(
        "SELECT id, plataforma, url_original as link, texto_bruto as titulo, imagem_url, data_captura FROM achadinhos ORDER BY data_captura DESC LIMIT 50"
      ).all();
      if (res1.results) allResults = allResults.concat(res1.results);
    } catch (e1) { console.error("Erro leitura achadinhos:", e1); }

    // Busca tabela ML
    try {
      const res2 = await env.DB.prepare(
        "SELECT id, 'mercado_livre' as plataforma, url_original as link, texto_bruto as titulo, imagem_url, data_captura FROM mercado_livre ORDER BY data_captura DESC LIMIT 50"
      ).all();
      if (res2.results) allResults = allResults.concat(res2.results);
    } catch (e2) { console.error("Erro leitura ML:", e2); }

    // Ordena por data mais recente e limita a 50 itens
    allResults.sort((a, b) => new Date(b.data_captura) - new Date(a.data_captura));
    const results = allResults.slice(0, 50);

    // Configurações de lojas para formatação final
    const LOJAS = {
      shopee: "18338650355",
      ml: "https://lista.mercadolivre.com.br/_CustId_ML202408011903400660",
      magalu: "https://www.magazinevoce.com.br/magazinehdmicroloja",
      amazon_tag: "coloposte-20"
    };

    const ofertas = results.map(item => {
      let link = item.link || "";
      let loja = (item.plataforma || "OUTROS").toUpperCase();

      // Reaplica injeção garantida na saída (segurança extra)
      if (loja.includes('SHOPEE')) {
        const m = link.match(/i\.(\d+)\.(\d+)/);
        link = m ? `${LOJAS.shopee.split('?')[0]}/i.${m[1]}.${m[2]}` : LOJAS.shopee;
        loja = 'SHOPEE';
      } else if (loja.includes('MERCADO') || loja.includes('ML')) {
        link = LOJAS.ml;
        loja = 'MERCADO LIVRE';
      } else if (loja.includes('MAGALU')) {
        link = LOJAS.magalu;
        loja = 'MAGALU';
      } else if (loja.includes('AMAZON')) {
        if (!link.includes('tag=')) link += (link.includes('?') ? '&' : '?') + `tag=${LOJAS.amazon_tag}`;
        loja = 'AMAZON';
      }

      return {
        id: item.id,
        loja,
        titulo: (item.titulo || "Oferta Exclusiva").substring(0, 120),
        link,
        imagem: item.imagem_url || null,
        preco: "Ver oferta" // Pode ser expandido futuramente com scraping de preço
      };
    });

    return new Response(JSON.stringify(ofertas), { headers: corsHeaders });

  } catch (err) {
    console.error("Erro geral ao buscar ofertas:", err);
    return new Response(JSON.stringify([]), { status: 200, headers: corsHeaders });
  }
}

// ============================================================================
// FUNÇÃO 3: LIMPEZA AUTOMÁTICA (CRON)
// ============================================================================
async function handleCron(env) {
  try {
    // Apaga ofertas com mais de 7 dias
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    await env.DB.prepare("DELETE FROM achadinhos WHERE data_captura < ?").bind(seteDiasAtras).run();
    await env.DB.prepare("DELETE FROM mercado_livre WHERE data_captura < ?").bind(seteDiasAtras).run();
    
    console.log(`✅ Limpeza automática concluída em ${new Date().toISOString()}`);
  } catch (e) {
    console.error("❌ Erro no cron de limpeza:", e);
  }
}
