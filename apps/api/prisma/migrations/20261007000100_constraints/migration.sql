-- B-101 (docs/17 par. 1, 8, 10): ograniczenia spoza skladni Prisma - CHECK, czesciowe indeksy,
-- NULLS NOT DISTINCT i wyzwalacze tylko-dopisywanie. Pisane recznie, obok migracji Prisma.

-- Katalog ------------------------------------------------------------------
ALTER TABLE "products"
  ADD CONSTRAINT "products_brand_check" CHECK ("brand" = 'Taktyl'),
  ADD CONSTRAINT "products_status_check" CHECK ("status" IN ('active', 'archived'));

ALTER TABLE "variants"
  ADD CONSTRAINT "variants_sku_check" CHECK (
    "sku" ~ '^(K-[A-Z0-9]{2,8}-[A-Z]{3}-[A-Z]{3}|M-[A-Z0-9]{2,8}-[A-Z]{3}|P-[A-Z0-9]{2,8}-(M|L|XL|XXL)-[A-Z]{3})$'
  ),
  ADD CONSTRAINT "variants_stock_check" CHECK ("stock" >= 0),
  ADD CONSTRAINT "variants_price_check" CHECK ("price_gr" > 0),
  ADD CONSTRAINT "variants_regular_price_check" CHECK ("regular_price_gr" IS NULL OR "regular_price_gr" > 0),
  ADD CONSTRAINT "variants_status_check" CHECK ("status" IN ('active', 'disabled')),
  ADD CONSTRAINT "variants_size_key_check" CHECK ("size_key" IS NULL OR "size_key" IN ('m', 'l', 'xl', 'xxl'));

-- Jeden wariant na kombinacje (kolor, przelacznik, rozmiar); NULL-e traktowane jak rowne (PostgreSQL 15+).
ALTER TABLE "variants"
  ADD CONSTRAINT "variants_product_color_switch_size_key"
  UNIQUE NULLS NOT DISTINCT ("product_id", "color_id", "switch_id", "size_key");

ALTER TABLE "product_images"
  ADD CONSTRAINT "product_images_kind_check" CHECK ("kind" IN ('packshot', 'topdown', 'texture')),
  ADD CONSTRAINT "product_images_priority_check" CHECK ("priority" IN ('P0', 'P1')),
  ADD CONSTRAINT "product_images_status_check" CHECK ("status" IN ('brak', 'gotowe'));

ALTER TABLE "facet_definitions"
  ADD CONSTRAINT "facet_definitions_type_check" CHECK ("type" IN ('multi', 'range', 'bool', 'buckets', 'number-match'));

-- Ustawienia sklepu ----------------------------------------------------------
ALTER TABLE "shop_settings"
  ADD CONSTRAINT "shop_settings_promo_window_check" CHECK ("promo_window_days" BETWEEN 1 AND 365),
  ADD CONSTRAINT "shop_settings_money_check" CHECK ("free_shipping_threshold_gr" >= 0);

ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_price_check" CHECK ("price_gr" >= 0);

ALTER TABLE "discount_codes"
  ADD CONSTRAINT "discount_codes_type_check" CHECK ("type" IN ('percent', 'free_shipping'));

-- Ceny i magazyn ---------------------------------------------------------------
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_price_check" CHECK ("price_gr" > 0);

-- Dokladnie jeden obowiazujacy wiersz (valid_to IS NULL) na SKU.
CREATE UNIQUE INDEX "price_history_sku_open_key" ON "price_history" ("sku") WHERE "valid_to" IS NULL;

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_kind_check" CHECK ("kind" IN ('seed', 'adjustment', 'sale', 'sale_reverted'));

-- Zamowienia -------------------------------------------------------------------
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_number_check" CHECK (
    "number" ~ '^TK-[0-9]{6}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$'
  ),
  ADD CONSTRAINT "orders_status_check" CHECK (
    "status" IN ('pending_payment', 'payment_failed', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')
  ),
  ADD CONSTRAINT "orders_payment_type_check" CHECK ("payment_type" IN ('blik', 'karta', 'przelew-online', 'przelew')),
  ADD CONSTRAINT "orders_amounts_check" CHECK (
    "items_gr" >= 0 AND "set_discount_gr" >= 0 AND "coupon_discount_gr" >= 0 AND "shipping_gr" >= 0
  ),
  ADD CONSTRAINT "orders_total_check" CHECK (
    "total_gr" = "items_gr" - "set_discount_gr" - "coupon_discount_gr" + "shipping_gr"
  );

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_qty_check" CHECK ("qty" BETWEEN 1 AND 10),
  ADD CONSTRAINT "order_items_price_check" CHECK ("unit_price_gr" > 0 AND "set_discount_gr" >= 0 AND "coupon_discount_gr" >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_type_check" CHECK ("type" IN ('blik', 'karta', 'przelew-online', 'przelew')),
  ADD CONSTRAINT "payments_status_check" CHECK ("status" IN ('created', 'paid', 'failed'));

-- Tresci -----------------------------------------------------------------------
ALTER TABLE "content_pages"
  ADD CONSTRAINT "content_pages_type_check" CHECK ("type" IN ('page', 'guide', 'faq')),
  ADD CONSTRAINT "content_pages_status_check" CHECK ("status" IN ('draft', 'published', 'archived'));

ALTER TABLE "faq_items" ADD CONSTRAINT "faq_items_status_check" CHECK ("status" IN ('draft', 'published', 'archived'));

-- Opinie sa zawsze demonstracyjne (docs/04 par. 8, docs/11).
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_demo_check" CHECK ("demo" = true),
  ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5);

-- Backpanel i infrastruktura ----------------------------------------------------
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_check" CHECK ("role" IN ('owner', 'editor', 'viewer'));
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_status_check" CHECK ("status" IN ('pending', 'sent', 'failed'));

-- Wyzwalacze tylko-dopisywanie ---------------------------------------------------
-- audit_log: brak UPDATE; DELETE tylko w zadaniu retencji (SET LOCAL taktyl.retention = 'on').
CREATE FUNCTION "taktyl_audit_log_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('taktyl.retention', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_log jest tabela tylko do dopisywania (%)', TG_OP USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "audit_log_append_only"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION "taktyl_audit_log_append_only"();

-- price_history: jedyna dozwolona zmiana wiersza to zamkniecie (valid_to z NULL na wartosc);
-- DELETE zabroniony (czyszczenie danych demo idzie przez TRUNCATE).
CREATE FUNCTION "taktyl_price_history_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."valid_to" IS NULL
     AND NEW."valid_to" IS NOT NULL
     AND NEW."id" = OLD."id"
     AND NEW."sku" = OLD."sku"
     AND NEW."price_gr" = OLD."price_gr"
     AND NEW."valid_from" = OLD."valid_from"
     AND NEW."valid_to" > OLD."valid_from" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'price_history jest tabela tylko do dopisywania (%)', TG_OP USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "price_history_append_only"
  BEFORE UPDATE OR DELETE ON "price_history"
  FOR EACH ROW EXECUTE FUNCTION "taktyl_price_history_append_only"();
