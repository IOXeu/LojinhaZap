-- Migração aditiva; não remove tabelas legadas.
CREATE TABLE IF NOT EXISTS anuncios (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 dedupe_key TEXT NOT NULL UNIQUE,
 plataforma TEXT NOT NULL,
 url_original TEXT NOT NULL,
 url_destino TEXT NOT NULL,
 texto_bruto TEXT NOT NULL,
 imagem_url TEXT,
 origem TEXT NOT NULL DEFAULT 't1',
 status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo','oculto','expirado')),
 data_captura TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_anuncios_status_data ON anuncios(status,data_captura DESC);
CREATE INDEX IF NOT EXISTS idx_anuncios_plataforma_data ON anuncios(plataforma,data_captura DESC);
