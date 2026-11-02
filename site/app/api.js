const API_BASE = "https://lojinhazap.hdmicro.workers.dev";

export async function fetchOffers() {
  const response = await fetch(`${API_BASE}/api/ofertas?limit=60`, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Não foi possível consultar o catálogo (${response.status}).`);
  const payload = await response.json();
  if (!Array.isArray(payload.ofertas)) throw new Error("Resposta do catálogo fora do formato esperado.");
  return payload.ofertas;
}
