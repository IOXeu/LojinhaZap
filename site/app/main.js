import { fetchOffers } from "./api.js";
import { answerFromCatalog, createVoiceInput } from "./assistant.js";

const grid = document.querySelector("#offers-grid");
const status = document.querySelector("#offers-status");
const search = document.querySelector("#offer-search");
let offers = [];
let activeFilter = "todas";

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function categoryOf(offer) {
  const text = (offer.titulo || offer.texto_bruto || "").toLowerCase();
  if (/sapato|tenis|tênis|sandalia|sandália|chinelo|bota/.test(text)) return "calcados";
  if (/bebe|bebê|infantil|fralda|mamadeira|body/.test(text)) return "bebes";
  if (/camisa|vestido|calca|calça|blusa|roupa|moda/.test(text)) return "roupas";
  if (/fone|celular|notebook|mouse|teclado|smart|eletron|eletrôn/.test(text)) return "tech";
  return "outros";
}
function renderOffers() {
  const term = search.value.trim().toLocaleLowerCase("pt-BR");
  const filtered = offers.filter(offer => {
    const text = [offer.titulo, offer.texto_bruto, offer.plataforma, offer.loja].join(" ").toLocaleLowerCase("pt-BR");
    return (!term || text.includes(term)) && (activeFilter === "todas" || categoryOf(offer) === activeFilter);
  });
  grid.innerHTML = filtered.length ? filtered.map(offer => {
    const title = safeText(offer.titulo || offer.texto_bruto || "Achadinho");
    const link = safeText(offer.url_original || offer.link || "#");
    const image = offer.imagem_url && /^https?:\/\//i.test(offer.imagem_url) ? `<img loading="lazy" src="${safeText(offer.imagem_url)}" alt="">` : "🐞";
    const price = offer.preco ? `<div class="offer-price">${safeText(offer.preco)}</div>` : "";
    return `<article class="offer-card"><div class="offer-image">${image}</div><div class="offer-body"><span class="offer-platform">${safeText(offer.plataforma || "Achadinho")}</span><h3 class="offer-title">${title}</h3>${price}<a class="offer-link" href="${link}" target="_blank" rel="noopener noreferrer">Ver na loja ↗</a></div></article>`;
  }).join("") : `<div class="empty-state">${offers.length ? "Não encontrei ofertas com esse filtro. Tente outra busca. 💛" : "Assim que o catálogo receber ofertas, elas vão aparecer aqui. 🐞"}</div>`;
  status.textContent = `${filtered.length} ${filtered.length === 1 ? "achadinho encontrado" : "achadinhos encontrados"}`;
}
async function loadOffers() {
  try {
    offers = await fetchOffers();
    status.textContent = "Catálogo atualizado com dados do Worker.";
    renderOffers();
  } catch (error) {
    status.textContent = "Não consegui acessar o catálogo agora. Tente novamente mais tarde.";
    grid.innerHTML = '<div class="empty-state">As ofertas ainda não estão disponíveis. A Juju não vai inventar produtos ou preços. 💛</div>';
    console.warn("Catálogo da Juju:", error);
  }
}

document.querySelectorAll(".filter").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".filter").forEach(item => item.classList.toggle("active", item === button));
  activeFilter = button.dataset.filter;
  renderOffers();
}));
document.querySelectorAll(".room-card").forEach(card => card.addEventListener("click", () => {
  activeFilter = card.dataset.category;
  document.querySelectorAll(".filter").forEach(item => item.classList.toggle("active", item.dataset.filter === activeFilter));
  renderOffers();
}));

search.addEventListener("input", renderOffers);

const panel = document.querySelector("#assistant-panel");
const backdrop = document.querySelector("#panel-backdrop");
const messages = document.querySelector("#assistant-messages");
const input = document.querySelector("#assistant-input");
function toggleAssistant(open) {
  panel.classList.toggle("open", open);
  backdrop.classList.toggle("show", open);
  panel.setAttribute("aria-hidden", String(!open));
  if (open) input.focus();
}
document.querySelectorAll("#open-assistant,#banner-assistant").forEach(button => button.addEventListener("click", () => toggleAssistant(true)));
document.querySelector("#close-assistant").addEventListener("click", () => toggleAssistant(false));
backdrop.addEventListener("click", () => toggleAssistant(false));

function addMessage(text, type) {
  const bubble = document.createElement("div");
  bubble.className = type === "user" ? "user-message" : "juju-message";
  bubble.textContent = text;
  messages.append(bubble);
  messages.scrollTop = messages.scrollHeight;
}
document.querySelector("#assistant-form").addEventListener("submit", event => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question) return;
  addMessage(question, "user");
  addMessage(answerFromCatalog(question, offers), "juju");
  input.value = "";
});

const voice = createVoiceInput(text => {
  input.value = text;
  document.querySelector("#assistant-form").requestSubmit();
});
const voiceButton = document.querySelector("#voice-button");
if (!voice.available) {
  voiceButton.disabled = true;
  voiceButton.title = "Seu navegador não oferece reconhecimento de voz. Você pode digitar.";
} else {
  voiceButton.addEventListener("click", () => {
    try { voice.start(); } catch { addMessage("Não consegui iniciar o microfone. Verifique a permissão do navegador.", "juju"); }
  });
}

loadOffers();
