ALTER TABLE "supplier_current_list"
  ADD COLUMN "snapshot_scope" VARCHAR(120) NOT NULL DEFAULT 'legacy:default';

DROP INDEX "uq_supplier_current_list_supplier_contact";

CREATE UNIQUE INDEX "uq_supplier_current_list_supplier_contact_scope"
  ON "supplier_current_list"("supplier_contact_id", "snapshot_scope");
