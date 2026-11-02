function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function answerFromCatalog(question, offers) {
  const query = normalize(question).trim();
  if (!query) return "Pode me contar o que você está procurando? 💛";
  const terms = query.split(/\s+/).filter(word => word.length > 2 && !["quero","procuro","tem","uma","com","para","por","qual","preco","preço"].includes(word));
  const matches = offers.filter(offer => {
    const haystack = normalize([offer.titulo, offer.texto_bruto, offer.plataforma, offer.loja].join(" "));
    return terms.length ? terms.some(term => haystack.includes(term)) : false;
  }).slice(0, 4);
  if (!matches.length) return offers.length
    ? "Procurei no catálogo disponível e não encontrei um item correspondente. Posso tentar com outro nome ou palavra. 🐞"
    : "Ainda não há ofertas carregadas no catálogo. Assim que os anúncios chegarem ao banco, vou conseguir procurar por eles. 💛";
  return "Olha o que encontrei no nosso catálogo:\n" + matches.map(item => `• ${item.titulo || item.texto_bruto || "Oferta"}${item.preco ? ` — ${item.preco}` : ""}`).join("\n") + "\nOs links estão nos cartões de achadinhos logo abaixo. Confira as condições na loja antes de comprar. 💛";
}

export function createVoiceInput(onText) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return { available: false, start() {} };
  const recognition = new SpeechRecognition();
  recognition.lang = "pt-BR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = event => onText(event.results[0][0].transcript);
  return { available: true, start: () => recognition.start() };
}
