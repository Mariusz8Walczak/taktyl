-- ADR-0011 (F-256): pozycje zamowienia z konfiguracji wlasnej (kod i rozwiazana konfiguracja, bez ruchu magazynowego).
ALTER TABLE "order_items" ADD COLUMN "config_sku" TEXT;
ALTER TABLE "order_items" ADD COLUMN "config" JSONB;
