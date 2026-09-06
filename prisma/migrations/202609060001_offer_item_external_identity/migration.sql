-- Preserve canonical items while allowing an external commercial identity.
ALTER TABLE "item_oferta"
  ALTER COLUMN "produto_id" DROP NOT NULL;

ALTER TABLE "item_oferta"
  ADD COLUMN "origem_externa" VARCHAR(8),
  ADD COLUMN "provider_externo" VARCHAR(80),
  ADD COLUMN "produto_origem_externo_id" VARCHAR(255),
  ADD COLUMN "produto_origem_externo_nome" VARCHAR(500),
  ADD COLUMN "produto_origem_externo_url" VARCHAR(2048),
  ADD COLUMN "varejista_externo" VARCHAR(255);

ALTER TABLE "item_oferta"
  ADD CONSTRAINT "chk_item_oferta_identidade_canonica_ou_externa"
  CHECK (
    "produto_id" IS NOT NULL
    OR (
      NULLIF(BTRIM("origem_externa"), '') IS NOT NULL
      AND NULLIF(BTRIM("provider_externo"), '') IS NOT NULL
      AND NULLIF(BTRIM("produto_origem_externo_id"), '') IS NOT NULL
    )
  );

CREATE INDEX "idx_item_oferta_identidade_externa"
  ON "item_oferta"("origem_externa", "provider_externo", "produto_origem_externo_id");
