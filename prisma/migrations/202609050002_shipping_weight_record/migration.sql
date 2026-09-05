CREATE TABLE "peso_envio_operacional" (
  "id" UUID NOT NULL,
  "chave_peso_envio" TEXT NOT NULL,
  "peso_envio_lbs" DECIMAL(8,3) NOT NULL,
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "peso_envio_operacional_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_peso_envio_chave" ON "peso_envio_operacional"("chave_peso_envio");
