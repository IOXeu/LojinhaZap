# Mundo da Juju — site

Site estático responsivo da Casa da Juju. O HTML, os estilos e a lógica da aplicação ficam separados para facilitar manutenção.

## Estrutura
- `index.html`: estrutura semântica da página.
- `styles/tokens.css`: cores, fontes e variáveis visuais.
- `styles/base.css`: tipografia, layout principal e ilustração CSS da casinha.
- `styles/components.css`: cartões, catálogo, painel da Juju e responsividade.
- `app/api.js`: leitura do catálogo no Cloudflare Worker.
- `app/assistant.js`: busca conversacional somente nos dados carregados e entrada por voz quando o navegador oferece suporte.
- `app/main.js`: filtros, renderização, eventos e inicialização.

## Cloudflare Pages
- Diretório raiz do projeto: `/`
- Diretório de saída da build: `site`
- Comando de build: deixar vazio (site estático sem etapa de compilação).
- A branch de produção deve permanecer `main` até a revisão e validação da branch de desenvolvimento.

## API
O site consulta `GET https://lojinhazap.hdmicro.workers.dev/api/ofertas?limit=60`. A API precisa permitir CORS para a origem do Pages. O catálogo é renderizado apenas com registros devolvidos pelo Worker; não há produtos, preços ou avaliações fictícias.

## Próximas integrações
Os cinco jogos existentes devem ser incorporados a partir de seus arquivos originais, preservando seu funcionamento. A automação T2 e a publicação no canal oficial ainda dependem de validação e integração próprias.
