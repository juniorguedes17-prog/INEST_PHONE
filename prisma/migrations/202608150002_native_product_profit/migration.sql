CREATE TYPE "product_condition" AS ENUM ('novo', 'seminovo', 'cpo');

ALTER TABLE "produto"
  ADD COLUMN "produto_id" INTEGER,
  ADD COLUMN "produto_descricao" VARCHAR(240),
  ADD COLUMN "produto_descricao_normalizada" VARCHAR(240),
  ADD COLUMN "condicao_produto" "product_condition",
  ADD COLUMN "lucro_liquido" DECIMAL(12, 2),
  ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX "uq_produto_lucro_produto_id" ON "produto"("produto_id");
CREATE UNIQUE INDEX "uq_produto_condicao_descricao_lucro"
  ON "produto"("condicao_produto", "produto_descricao_normalizada");
CREATE INDEX "idx_produto_condicao_lucro_ativo"
  ON "produto"("condicao_produto", "ativo");
