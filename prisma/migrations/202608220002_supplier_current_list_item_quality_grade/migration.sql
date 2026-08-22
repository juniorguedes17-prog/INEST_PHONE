-- Preserve supplier offer quality independently from the catalog Product.
ALTER TABLE "supplier_current_list_item" ADD COLUMN "quality_grade" VARCHAR(8);
