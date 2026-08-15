-- Persist refresh-token identifiers so sessions survive API restarts.
-- The signed refresh token itself is never stored.
CREATE TABLE "sessao_refresh" (
    "id" UUID NOT NULL,
    "token_id" VARCHAR(36) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessao_refresh_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_sessao_refresh_token_id" ON "sessao_refresh"("token_id");
CREATE INDEX "idx_sessao_refresh_usuario_id" ON "sessao_refresh"("usuario_id");
CREATE INDEX "idx_sessao_refresh_expires_at" ON "sessao_refresh"("expires_at");

ALTER TABLE "sessao_refresh"
  ADD CONSTRAINT "sessao_refresh_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
