ALTER TABLE "supplier_current_list_item"
  ADD COLUMN "produto_id" UUID;

CREATE INDEX "idx_supplier_current_list_item_produto_id"
  ON "supplier_current_list_item"("produto_id");

ALTER TABLE "supplier_current_list_item"
  ADD CONSTRAINT "supplier_current_list_item_produto_id_fkey"
  FOREIGN KEY ("produto_id") REFERENCES "produto"("id")
  ON DELETE SET NULL
  ON UPDATE NO ACTION;
