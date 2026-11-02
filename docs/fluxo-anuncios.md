# Fluxo de anúncios — Mundo da Juju

## Etapas
1. T1 ColePoste captura mensagens com links no WhatsApp Web.
2. T1 envia plataforma, URL original, texto e imagem ao Worker.
3. Worker valida e salva no D1 com deduplicação.
4. GET /api/ofertas entrega ofertas ativas ao site.
5. O Worker publicar no canal oficial requer integração de envio real e autorizada; não será simulada.
6. T2 deverá observar novas publicações do canal oficial e encaminhá-las ao site após validar os seletores atuais do WhatsApp Web.

Canal oficial: https://whatsapp.com/channel/0029VakWvg6BadmYSshQ2V1Q

## Segurança e validação
- Configure o binding D1 `DB` e o secret `INGEST_TOKEN`.
- Aplique a migração somente ao banco correto, após revisar o destino.
- Teste token inválido, inserção, duplicata e GET /api/ofertas.
- Nenhum deploy, migração em produção ou publicação real foi executado.
