// ==UserScript==
// @name         ColePoste — Capturador de Ofertas v3.6
// @namespace    https://github.com/IOXeu/LojinhaZap
// @version      3.6.0
// @description  Captura mensagens com links no WhatsApp Web e envia ao Worker LojinhaZap.
// @match        https://web.whatsapp.com/*
// @grant        GM_xmlhttpRequest
// @connect      alojinhazap.hdmicro.workers.dev
// ==/UserScript==

(function () {
  'use strict';
  const API_URL = 'https://alojinhazap.hdmicro.workers.dev/api/achadinhos';
  // Configure localmente o mesmo token definido como secret INGEST_TOKEN no Worker.
  // Não coloque o token real em repositório público.
  const INGEST_TOKEN = 'CONFIGURE_UM_TOKEN_LOCAL_AQUI';
  const processadas = new Set();
  const emEnvio = new Set();
  let total = 0;

  function criarPainel() {
    if (document.getElementById('coleposte-widget')) return;
    const el = document.createElement('div');
    el.id = 'coleposte-widget';
    el.innerHTML = `<div id="cp-header" style="cursor:move;background:#00a884;color:#fff;padding:8px 12px;font-weight:bold;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;font:13px sans-serif"><span>🚀 ColePoste Bot v3.6</span><span id="cp-toggle" style="cursor:pointer">_</span></div>
    <div id="cp-body" style="padding:10px 12px;font:12px sans-serif;color:#e9edef;background:#111b21">
    <div>📦 Enviados: <strong id="cp-count" style="color:#00ff88">0</strong></div>
    <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px">📡 Último: <span id="cp-last" style="color:#ffb703">Aguardando...</span></div>
    <div id="cp-status" style="margin-top:6px;color:#b8c7ce">Iniciando…</div></div>`;
    Object.assign(el.style, {position:'fixed',bottom:'20px',right:'20px',width:'240px',background:'#111b21',borderRadius:'8px',boxShadow:'0 4px 12px rgba(0,0,0,.5)',zIndex:'999999',border:'1px solid #222d34'});
    document.body.appendChild(el);
    el.querySelector('#cp-header').addEventListener('mousedown', e => {
      if (e.target.closest('#cp-toggle')) return;
      e.preventDefault();
      const x=e.clientX,y=e.clientY,r=el.getBoundingClientRect();
      const move=m=>{el.style.left=(r.left+m.clientX-x)+'px';el.style.top=(r.top+m.clientY-y)+'px';el.style.right='auto';el.style.bottom='auto';};
      const up=()=>{document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);};
      document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);
    });
    el.querySelector('#cp-toggle').addEventListener('click',()=>{
      const b=el.querySelector('#cp-body'), hidden=b.style.display==='none';
      b.style.display=hidden?'block':'none';el.querySelector('#cp-toggle').textContent=hidden?'_':'+';
    });
  }
  function setStatus(text,color='#b8c7ce'){const e=document.getElementById('cp-status');if(e){e.textContent=text;e.style.color=color;}}
  function detectPlatform(link) {
    let h='';try{h=new URL(link).hostname.toLowerCase();}catch{return 'outros';}
    if(/shopee|shp\.ee|collshp/.test(h))return 'shopee';
    if(/mercadolivre|mercadolibre|meli\.la/.test(h))return 'mercado_livre';
    if(/magazinevoce|magazineluiza|magalu/.test(h))return 'magalu';
    if(/amazon|amzn\.to/.test(h))return 'amazon';
    return 'outros';
  }
  function imageUrl(node) {
    const img=[...node.querySelectorAll('img[src^="http"]')].find(i=>!i.src.startsWith('blob:'));
    return img?.src || null;
  }
  function send(link,text,image,key) {
    if(processadas.has(key)||emEnvio.has(key))return;
    emEnvio.add(key);
    if(INGEST_TOKEN.startsWith('CONFIGURE_')) {setStatus('Configure o token no script.', '#ffb703');emEnvio.delete(key);return;}
    setStatus('Enviando anúncio…');
    GM_xmlhttpRequest({
      method:'POST',url:API_URL,timeout:20000,
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+INGEST_TOKEN},
      data:JSON.stringify({plataforma:detectPlatform(link),url_original:link,texto_bruto:text.slice(0,20000),imagem_url:image,origem:'t1'}),
      onload:r=>{
        emEnvio.delete(key);
        if(r.status>=200&&r.status<300){
          processadas.add(key);total++;
          document.getElementById('cp-count').textContent=String(total);
          document.getElementById('cp-last').textContent=(text.split('\n').find(s=>s.trim())||link).slice(0,25);
          setStatus('Oferta registrada ou duplicada.', '#00ff88');
        } else {setStatus('Erro HTTP '+r.status+'; nova tentativa possível.', '#ff6b6b');}
      },
      onerror:()=>{emEnvio.delete(key);setStatus('Falha de rede; nova tentativa possível.', '#ff6b6b');},
      ontimeout:()=>{emEnvio.delete(key);setStatus('Tempo esgotado; nova tentativa possível.', '#ff6b6b');}
    });
  }
  function scan() {
    // Seletor propositalmente restrito; validar no DOM real de canais do WhatsApp.
    document.querySelectorAll('.message-in').forEach(node=>{
      const text=(node.innerText||'').trim();if(!text)return;
      const link=[...node.querySelectorAll('a[href^="http"]')].map(a=>a.href).find(h=>{
        try {const host=new URL(h).hostname.toLowerCase();return !/whatsapp\.com|facebook\.com|fb\.com/.test(host);}catch{return false;}
      });
      if(!link)return;
      const key=node.getAttribute('data-id')||link+'|'+text.slice(0,160);
      if(!processadas.has(key)&&!emEnvio.has(key))send(link,text,imageUrl(node),key);
    });
  }
  function start(){
    const app=document.querySelector('#app');
    if(!app){setTimeout(start,1500);return;}
    criarPainel();scan();
    new MutationObserver(scan).observe(app,{childList:true,subtree:true});
    setStatus('Monitoramento ativo; confirme os seletores no WhatsApp Web.', '#00ff88');
  }
  setTimeout(start,6000);
})();
