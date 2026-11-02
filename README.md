# LojinhaZap — Mundo da Juju

Implementação inicial do fluxo de anúncios em desenvolvimento na branch `feat/fluxo-anuncios-juju`. A branch `main` permanece intacta.

## Arquivos adicionados
- `worker/index.js`: API Worker para ingestão autenticada, consulta e expiração lógica.
- `worker/migrations/0001_create_anuncios.sql`: tabela canônica aditiva com URL original e URL de destino separadas e deduplicação.
- `worker/wrangler.toml.example`: exemplo de configuração; preencher com o ID real do D1.
- `userscripts/coleposte-t1.user.js`: T1 adaptado ao contrato do Worker.
- `docs/fluxo-anuncios.md`: arquitetura e plano de validação.

## Fluxo planejado
T1 captura uma oferta no WhatsApp Web → Worker valida e grava no D1 → o site consulta `GET /api/ofertas`. O canal oficial e o T2 fazem parte da arquitetura final, mas precisam de integração de publicação e validação real do DOM do WhatsApp antes de serem considerados operacionais.

## Configuração necessária
- D1 binding `DB`
- Secret `INGEST_TOKEN` no Worker e o mesmo token configurado localmente no T1
- Opcional: `CORS_ORIGINS` para as origens do site

Não use o placeholder do T1 como token real. Não publique tokens em repositório público.

## Importante
O Worker e a migração são uma base inicial; ainda precisam de testes locais contra o banco correto. Nenhum deploy, migração em produção ou postagem real no canal foi executado. Revise o contrato e a configuração antes de ativar.
