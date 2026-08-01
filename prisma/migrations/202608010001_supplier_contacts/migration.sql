-- CreateTable
CREATE TABLE "supplier_contacts" (
    "id" UUID NOT NULL,
    "supplier_name" VARCHAR(160) NOT NULL,
    "whatsapp_number" VARCHAR(15) NOT NULL,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_supplier_contacts_whatsapp_number" ON "supplier_contacts"("whatsapp_number");

-- CreateIndex
CREATE INDEX "idx_supplier_contacts_is_active" ON "supplier_contacts"("is_active");
