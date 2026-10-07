-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "h1" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colors" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "harmony" TEXT NOT NULL,
    "swatch" TEXT NOT NULL,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "switches" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "type_label" TEXT NOT NULL,
    "force_g" INTEGER NOT NULL,
    "sound" TEXT NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "switches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'Taktyl',
    "short" TEXT NOT NULL,
    "description" TEXT,
    "attributes" JSONB NOT NULL,
    "options" TEXT[],
    "default_variant_sku" TEXT,
    "badges" TEXT[],
    "fit" JSONB NOT NULL,
    "in_box" TEXT[],
    "gpsr" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variants" (
    "sku" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "color_id" TEXT NOT NULL,
    "switch_id" TEXT,
    "size_key" TEXT,
    "price_gr" INTEGER NOT NULL,
    "regular_price_gr" INTEGER,
    "stock" INTEGER NOT NULL,
    "images_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("sku")
);

-- CreateTable
CREATE TABLE "product_images" (
    "key" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "color_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "shot" TEXT,
    "description" TEXT,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "files" TEXT[],
    "dims_mm" JSONB,
    "pixels" JSONB,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "presets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preset_items" (
    "preset_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,

    CONSTRAINT "preset_items_pkey" PRIMARY KEY ("preset_id","category_id")
);

-- CreateTable
CREATE TABLE "rule_settings" (
    "id" TEXT NOT NULL,
    "units" TEXT NOT NULL,
    "profiles" JSONB NOT NULL,
    "no_profile" JSONB NOT NULL,
    "gap_keyboard_mouse_mm" INTEGER NOT NULL,
    "edge_margin_mm" INTEGER NOT NULL,
    "checks" JSONB NOT NULL,
    "suggestion_order" JSONB NOT NULL,
    "never_block" BOOLEAN NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facet_definitions" (
    "category_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "attr" TEXT NOT NULL,
    "values" JSONB,
    "unit" TEXT,
    "hint" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "facet_definitions_pkey" PRIMARY KEY ("category_id","id")
);

-- CreateTable
CREATE TABLE "shop_settings" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "free_shipping_threshold_gr" INTEGER NOT NULL,
    "set_discount_percent" INTEGER NOT NULL,
    "set_discount_categories" TEXT[],
    "dispatch_cutoff_hour" INTEGER NOT NULL,
    "returns_days" INTEGER NOT NULL,
    "statutory_withdrawal_days" INTEGER NOT NULL,
    "payment_simulation" BOOLEAN NOT NULL,
    "promo_window_days" INTEGER NOT NULL DEFAULT 30,
    "demo_label" TEXT NOT NULL,
    "demo_email_domain" TEXT NOT NULL,
    "demo_phone" TEXT NOT NULL,
    "company" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_methods" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price_gr" INTEGER NOT NULL,
    "eta_business_days" INTEGER NOT NULL,
    "fields" TEXT[],
    "address" TEXT,
    "position" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "shipping_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_codes" (
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER,
    "scope" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMPTZ(6),
    "valid_to" TIMESTAMPTZ(6),

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "pickup_points" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pickup_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" BIGSERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "price_gr" INTEGER NOT NULL,
    "valid_from" TIMESTAMPTZ(6) NOT NULL,
    "valid_to" TIMESTAMPTZ(6),
    "changed_by" TEXT,
    "reason" TEXT,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" BIGSERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "stock_after" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "order_number" TEXT,
    "reason" TEXT,
    "actor" TEXT,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "order_token_hash" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "shipping_method_id" TEXT NOT NULL,
    "shipping_address" JSONB,
    "invoice" JSONB,
    "payment_type" TEXT NOT NULL,
    "coupon_code" TEXT,
    "items_gr" INTEGER NOT NULL,
    "set_discount_gr" INTEGER NOT NULL,
    "coupon_discount_gr" INTEGER NOT NULL,
    "shipping_gr" INTEGER NOT NULL,
    "total_gr" INTEGER NOT NULL,
    "consents" JSONB NOT NULL,
    "dispatch_date" DATE,
    "delivery_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "internal_note" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("number")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "group_id" TEXT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variant_label" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price_gr" INTEGER NOT NULL,
    "set_discount_gr" INTEGER NOT NULL DEFAULT 0,
    "coupon_discount_gr" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" BIGSERIAL NOT NULL,
    "order_number" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "note" TEXT,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "order_number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount_gr" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMPTZ(6),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("order_number")
);

-- CreateTable
CREATE TABLE "content_pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "lead" TEXT,
    "body_md" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "demo_notice" BOOLEAN NOT NULL DEFAULT false,
    "guide_profile" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_revisions" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "body_md" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_items" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer_md" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "rating" INTEGER NOT NULL,
    "variant_label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_signups" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_signups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "csrf_secret" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,
    "actor_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "request_id" TEXT NOT NULL,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tags" TEXT[],
    "audit_id" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "colors_code_key" ON "colors"("code");

-- CreateIndex
CREATE UNIQUE INDEX "switches_code_key" ON "switches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_category_id_status_idx" ON "products"("category_id", "status");

-- CreateIndex
CREATE INDEX "variants_product_id_idx" ON "variants"("product_id");

-- CreateIndex
CREATE INDEX "variants_color_id_idx" ON "variants"("color_id");

-- CreateIndex
CREATE INDEX "variants_switch_id_idx" ON "variants"("switch_id");

-- CreateIndex
CREATE INDEX "variants_product_id_status_idx" ON "variants"("product_id", "status");

-- CreateIndex
CREATE INDEX "product_images_product_id_color_id_idx" ON "product_images"("product_id", "color_id");

-- CreateIndex
CREATE INDEX "pickup_points_city_idx" ON "pickup_points"("city");

-- CreateIndex
CREATE INDEX "price_history_sku_valid_from_idx" ON "price_history"("sku", "valid_from" DESC);

-- CreateIndex
CREATE INDEX "stock_movements_sku_at_idx" ON "stock_movements"("sku", "at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_order_token_hash_idx" ON "orders"("order_token_hash");

-- CreateIndex
CREATE INDEX "order_items_order_number_idx" ON "order_items"("order_number");

-- CreateIndex
CREATE INDEX "order_items_sku_idx" ON "order_items"("sku");

-- CreateIndex
CREATE INDEX "order_status_history_order_number_at_idx" ON "order_status_history"("order_number", "at");

-- CreateIndex
CREATE UNIQUE INDEX "content_pages_slug_key" ON "content_pages"("slug");

-- CreateIndex
CREATE INDEX "content_pages_type_status_idx" ON "content_pages"("type", "status");

-- CreateIndex
CREATE INDEX "content_revisions_page_id_at_idx" ON "content_revisions"("page_id", "at" DESC);

-- CreateIndex
CREATE INDEX "reviews_product_id_date_idx" ON "reviews"("product_id", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_signups_email_key" ON "newsletter_signups"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_at_idx" ON "audit_log"("entity", "entity_id", "at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at" DESC);

-- CreateIndex
CREATE INDEX "outbox_status_next_attempt_at_idx" ON "outbox"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_default_variant_sku_fkey" FOREIGN KEY ("default_variant_sku") REFERENCES "variants"("sku") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_switch_id_fkey" FOREIGN KEY ("switch_id") REFERENCES "switches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preset_items" ADD CONSTRAINT "preset_items_preset_id_fkey" FOREIGN KEY ("preset_id") REFERENCES "presets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preset_items" ADD CONSTRAINT "preset_items_sku_fkey" FOREIGN KEY ("sku") REFERENCES "variants"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_sku_fkey" FOREIGN KEY ("sku") REFERENCES "variants"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sku_fkey" FOREIGN KEY ("sku") REFERENCES "variants"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_method_id_fkey" FOREIGN KEY ("shipping_method_id") REFERENCES "shipping_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_number_fkey" FOREIGN KEY ("order_number") REFERENCES "orders"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_sku_fkey" FOREIGN KEY ("sku") REFERENCES "variants"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_number_fkey" FOREIGN KEY ("order_number") REFERENCES "orders"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_number_fkey" FOREIGN KEY ("order_number") REFERENCES "orders"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "content_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_author_fkey" FOREIGN KEY ("author") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "audit_log"("id") ON DELETE SET NULL ON UPDATE CASCADE;

