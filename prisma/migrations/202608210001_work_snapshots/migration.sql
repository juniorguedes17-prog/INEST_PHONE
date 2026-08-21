-- CreateTable
CREATE TABLE "snapshot_trabalho" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "scope" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snapshot_trabalho_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_snapshot_trabalho_usuario_escopo" ON "snapshot_trabalho"("usuario_id", "scope");

-- CreateIndex
CREATE INDEX "idx_snapshot_trabalho_usuario_id" ON "snapshot_trabalho"("usuario_id");

-- CreateIndex
CREATE INDEX "idx_snapshot_trabalho_updated_at" ON "snapshot_trabalho"("updated_at");

-- AddForeignKey
ALTER TABLE "snapshot_trabalho" ADD CONSTRAINT "snapshot_trabalho_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
