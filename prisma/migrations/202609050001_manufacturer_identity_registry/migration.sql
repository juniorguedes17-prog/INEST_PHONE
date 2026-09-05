CREATE TABLE "fabricante" (
  "id" UUID NOT NULL,
  "chave_fabricante" VARCHAR(120) NOT NULL,
  "nome_canonico" VARCHAR(160) NOT NULL,
  "status" "generic_status" NOT NULL DEFAULT 'ativo',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fabricante_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fabricante_alias" (
  "id" UUID NOT NULL,
  "fabricante_id" UUID NOT NULL,
  "alias" VARCHAR(160) NOT NULL,
  "alias_normalizado" VARCHAR(180) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fabricante_alias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_fabricante_chave" ON "fabricante"("chave_fabricante");
CREATE INDEX "idx_fabricante_status" ON "fabricante"("status");
CREATE UNIQUE INDEX "uq_fabricante_alias_normalizado" ON "fabricante_alias"("alias_normalizado");
CREATE INDEX "idx_fabricante_alias_fabricante_id" ON "fabricante_alias"("fabricante_id");

ALTER TABLE "fabricante_alias"
  ADD CONSTRAINT "fabricante_alias_fabricante_id_fkey"
  FOREIGN KEY ("fabricante_id") REFERENCES "fabricante"("id")
  ON DELETE RESTRICT
  ON UPDATE NO ACTION;
