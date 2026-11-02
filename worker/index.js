const BASE_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...BASE_HEADERS, ...headers } });
}
function cors(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = String(env.CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const h = { "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "Content-Type, Authorization", "access-control-max-age": "86400", "vary": "Origin" };
  if (origin && (allowed.includes(origin) || (!allowed.length && /^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)))) h["access-control-allow-origin"] = origin;
  return h;
}
function isHttpUrl(value) {
  try { const u = new URL(value); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
}
function platformFor(value, url) {
  const p = String(value || "").toLowerCase().trim();
  if (["shopee","mercado_livre","magalu","amazon","outros"].includes(p)) return p;
  let h = ""; try { h = new URL(url).hostname.toLowerCase(); } catch {}
  if (/shopee|shp\.ee|collshp/.test(h)) return "shopee";
  if (/mercadolivre|mercadolibre|meli\.la/.test(h)) return "mercado_livre";
  if (/magazinevoce|magazineluiza|magalu/.test(h)) return "magalu";
  if (/amazon|amzn\.to/.test(h)) return "amazon";
  return "outros";
}
async function hash(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,"0")).join("");
}
function authorized(request, env) {
  return Boolean(env.INGEST_TOKEN) && request.headers.get("Authorization") === `Bearer ${env.INGEST_TOKEN}`;
}
async function ingest(request, env, source) {
  if (!authorized(request, env)) return json({ erro: "Não autorizado; configure INGEST_TOKEN." }, 401);
  if (!env.DB) return json({ erro: "Binding D1 DB não configurado." }, 500);
  let body; try { body = await request.json(); } catch { return json({ erro: "JSON inválido." }, 400); }
  const original = String(body.url_original || "").trim();
  const text = String(body.texto_bruto || "").trim();
  const image = body.imagem_url == null || body.imagem_url === "" ? null : String(body.imagem_url).trim();
  if (!isHttpUrl(original)) return json({ erro: "url_original precisa ser uma URL HTTP(S) válida." }, 400);
  if (!text) return json({ erro: "texto_bruto é obrigatório." }, 400);
  if (text.length > 20000) return json({ erro: "texto_bruto excede 20.000 caracteres." }, 413);
  if (image && !isHttpUrl(image)) return json({ erro: "imagem_url precisa ser HTTP(S) ou null." }, 400);
  const platform = platformFor(body.plataforma, original);
  // Preserve the source URL. Platform-specific affiliate rewrites must be explicit and verified.
  const destination = original;
  const dedupe = await hash(`${source}|${platform}|${original}|${text}`);
  const result = await env.DB.prepare(`
    INSERT INTO anuncios (dedupe_key, plataforma, url_original, url_destino, texto_bruto, imagem_url, origem)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(dedupe_key) DO NOTHING
  `).bind(dedupe, platform, original, destination, text, image, source).run();
  const inserted = Number(result.meta?.changes || 0) > 0;
  return json({ status: inserted ? "sucesso" : "duplicado", inserido: inserted, plataforma: platform, url_original: original, url_destino: destination }, inserted ? 201 : 200);
}
async function listOffers(request, env) {
  if (!env.DB) return json({ erro: "Binding D1 DB não configurado." }, 500);
  const limit = Math.min(100, Math.max(1, Number.parseInt(new URL(request.url).searchParams.get("limit") || "50", 10) || 50));
  const result = await env.DB.prepare(`
    SELECT id, plataforma, url_original, url_destino, texto_bruto, imagem_url, origem, data_captura
    FROM anuncios WHERE status = 'ativo' ORDER BY data_captura DESC LIMIT ?
  `).bind(limit).all();
  return json({ status: "sucesso", total: result.results.length, ofertas: result.results });
}
async function expireOld(env) {
  if (!env.DB) throw new Error("Binding D1 DB não configurado.");
  // Expira em vez de apagar permanentemente.
  await env.DB.prepare(`
    UPDATE anuncios SET status='expirado', atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE status='ativo' AND data_captura < strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')
  `).run();
}
export default {
  async fetch(request, env) {
    const headers = cors(request, env), url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    try {
      if (url.pathname === "/" && request.method === "GET") return json({ service: "LojinhaZap anúncios", status: "online" }, 200, headers);
      if (url.pathname === "/api/achadinhos" && request.method === "POST") {
        const r = await ingest(request, env, "t1"); return new Response(r.body, { status: r.status, headers: { ...Object.fromEntries(r.headers), ...headers } });
      }
      if (url.pathname === "/api/publicacoes-site" && request.method === "POST") {
        const r = await ingest(request, env, "t2"); return new Response(r.body, { status: r.status, headers: { ...Object.fromEntries(r.headers), ...headers } });
      }
      if (url.pathname === "/api/ofertas" && request.method === "GET") {
        const r = await listOffers(request, env); return new Response(r.body, { status: r.status, headers: { ...Object.fromEntries(r.headers), ...headers } });
      }
      return json({ erro: "Rota não encontrada." }, 404, headers);
    } catch (error) {
      console.error("Falha na API de anúncios:", error);
      return json({ erro: "Erro interno ao processar solicitação." }, 500, headers);
    }
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(expireOld(env)); }
};
