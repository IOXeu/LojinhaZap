import { json, isHttpUrl } from "./http.js";

const PLATFORMS = ["shopee", "mercado_livre", "magalu", "amazon", "outros"];

function platformFor(value, link) {
  const platform = String(value || "").toLowerCase().trim();
  if (PLATFORMS.includes(platform)) return platform;
  let host = "";
  try { host = new URL(link).hostname.toLowerCase(); } catch {}
  if (/shopee|shp\\.ee|collshp/.test(host)) return "shopee";
  if (/mercadolivre|mercadolibre|meli\\.la/.test(host)) return "mercado_livre";
  if (/magazinevoce|magazineluiza|magalu/.test(host)) return "magalu";
  if (/amazon|amzn\\.to/.test(host)) return "amazon";
  return "outros";
}

function authorized(request, env) {
  return Boolean(env.INGEST_TOKEN) && request.headers.get("Authorization") === `Bearer ${env.INGEST_TOKEN}`;
}

export async function ingest(request, env, source) {
  if (!authorized(request, env)) return json({ erro: "Não autorizado." }, 401);
  if (!env.DB) return json({ erro: "Binding D1 DB não configurado." }, 500);
  let body;
  try { body = await request.json(); } catch { return json({ erro: "JSON inválido." }, 400); }
  const link = String(body.url_original || "").trim();
  const text = String(body.texto_bruto || "").trim();
  const image = body.imagem_url ? String(body.imagem_url).trim() : null;
  if (!isHttpUrl(link)) return json({ erro: "URL HTTP(S) inválida." }, 400);
  if (!text) return json({ erro: "texto_bruto é obrigatório." }, 400);
  if (text.length > 20000) return json({ erro: "Texto excede 20.000 caracteres." }, 413);
  if (image && !isHttpUrl(image)) return json({ erro: "imagem_url inválida." }, 400);
  const platform = platformFor(body.plataforma, link);
  const existing = await env.DB.prepare("SELECT id FROM achadinhos WHERE url_original = ? AND texto_bruto = ? LIMIT 1").bind(link, text).first();
  if (existing) return json({ status: "duplicado", id: existing.id });
  const result = await env.DB.prepare("INSERT INTO achadinhos (plataforma, url_original, texto_bruto, imagem_url, data_captura) VALUES (?, ?, ?, ?, datetime('now'))").bind(platform, link, text, image).run();
  return json({ status: "sucesso", id: result.meta?.last_row_id ?? null, origem: source, plataforma: platform, url_original: link }, 201);
}

export async function listOffers(request, env) {
  if (!env.DB) return json({ erro: "Binding D1 DB não configurado." }, 500);
  const limit = Math.min(100, Math.max(1, Number.parseInt(new URL(request.url).searchParams.get("limit") || "50", 10) || 50));
  const result = await env.DB.prepare("SELECT id, plataforma, url_original, texto_bruto, imagem_url, data_captura FROM achadinhos ORDER BY datetime(data_captura) DESC, id DESC LIMIT ?").bind(limit).all();
  return json({ status: "sucesso", total: result.results.length, ofertas: result.results });
}
