-- Lista operacional atual por fornecedor, sem historico de cotacoes.
CREATE TABLE "supplier_current_list" (
    "id" UUID NOT NULL,
    "supplier_contact_id" UUID NOT NULL,
    "source_message_id" VARCHAR(180) NOT NULL,
    "source_type" VARCHAR(40) NOT NULL,
    "raw_content" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "supplier_current_list_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_current_list_item" (
    "id" UUID NOT NULL,
    "supplier_current_list_id" UUID NOT NULL,
    "product_name" VARCHAR(280) NOT NULL,
    "normalized_name" VARCHAR(280) NOT NULL,
    "category" VARCHAR(80),
    "model" VARCHAR(180),
    "capacity" VARCHAR(40),
    "color" VARCHAR(80),
    "condition" VARCHAR(40),
    "price" DECIMAL(12,2) NOT NULL,
    "availability" VARCHAR(80),
    "raw_line" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_current_list_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_current_list_attachment" (
    "id" UUID NOT NULL,
    "supplier_current_list_id" UUID NOT NULL,
    "file_name" VARCHAR(255),
    "mime_type" VARCHAR(120) NOT NULL,
    "storage_key" VARCHAR(500),
    "size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_current_list_attachment_pkey" PRIMARY KEY ("id")
);

-- Recibo sem payload, usado somente para bloquear reentregas da mesma mensagem.
CREATE TABLE "evolution_webhook_receipt" (
    "id" UUID NOT NULL,
    "external_message_id" VARCHAR(180) NOT NULL,
    "event" VARCHAR(80) NOT NULL,
    "supplier_contact_id" UUID,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evolution_webhook_receipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_supplier_current_list_supplier_contact" ON "supplier_current_list"("supplier_contact_id");
CREATE INDEX "idx_supplier_current_list_updated_at" ON "supplier_current_list"("updated_at");
CREATE INDEX "idx_supplier_current_list_item_list_id" ON "supplier_current_list_item"("supplier_current_list_id");
CREATE INDEX "idx_supplier_current_list_item_normalized_name" ON "supplier_current_list_item"("normalized_name");
CREATE INDEX "idx_supplier_current_list_attachment_list_id" ON "supplier_current_list_attachment"("supplier_current_list_id");
CREATE UNIQUE INDEX "uq_evolution_webhook_receipt_message_id" ON "evolution_webhook_receipt"("external_message_id");
CREATE INDEX "idx_evolution_webhook_receipt_supplier_contact_id" ON "evolution_webhook_receipt"("supplier_contact_id");
CREATE INDEX "idx_evolution_webhook_receipt_received_at" ON "evolution_webhook_receipt"("received_at");

ALTER TABLE "supplier_current_list" ADD CONSTRAINT "supplier_current_list_supplier_contact_id_fkey"
  FOREIGN KEY ("supplier_contact_id") REFERENCES "supplier_contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "supplier_current_list_item" ADD CONSTRAINT "supplier_current_list_item_supplier_current_list_id_fkey"
  FOREIGN KEY ("supplier_current_list_id") REFERENCES "supplier_current_list"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "supplier_current_list_attachment" ADD CONSTRAINT "supplier_current_list_attachment_supplier_current_list_id_fkey"
  FOREIGN KEY ("supplier_current_list_id") REFERENCES "supplier_current_list"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "evolution_webhook_receipt" ADD CONSTRAINT "evolution_webhook_receipt_supplier_contact_id_fkey"
  FOREIGN KEY ("supplier_contact_id") REFERENCES "supplier_contacts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
