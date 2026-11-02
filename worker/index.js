import { json, cors, isHttpUrl } from "./src/http.js";
import { ingest, listOffers } from "./src/offers.js";

export default {
  async fetch(request, env) {
    const headers = cors(request, env);
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    try {
      let response;
      if (url.pathname === "/" && request.method === "GET") {
        response = json({ service: "LojinhaZap", status: "online" });
      } else if (url.pathname === "/api/achadinhos" && request.method === "POST") {
        response = await ingest(request, env, "t1");
      } else if (url.pathname === "/api/publicacoes-site" && request.method === "POST") {
        response = await ingest(request, env, "t2");
      } else if (url.pathname === "/api/ofertas" && request.method === "GET") {
        response = await listOffers(request, env);
      } else {
        response = json({ erro: "Rota não encontrada." }, 404);
      }
      return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...headers } });
    } catch (error) {
      console.error("LojinhaZap:", error);
      return json({ erro: "Erro interno ao processar solicitação." }, 500, headers);
    }
  }
};
