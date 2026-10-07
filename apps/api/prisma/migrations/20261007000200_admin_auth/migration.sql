-- B-002, B-004, B-011, B-204 (TAKTYL-45, TAKTYL-48): uwierzytelnianie backpanelu, licznik prob logowania,
-- ip w dzienniku zmian i notatki wewnetrzne do zamowien. Migracja reczna (patrz API-002), bez zmian istniejacych danych.

-- sessions: bezczynnosc liczona od ostatniego uzycia (expires_at = bezwzgledny limit 12 h).
ALTER TABLE "sessions" ADD COLUMN "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- audit_log: zhashowany adres IP (HMAC, bez mozliwosci odczytu adresu). ALTER ADD COLUMN nie narusza wyzwalacza tylko-dopisywanie.
ALTER TABLE "audit_log" ADD COLUMN "ip_hash" TEXT;
CREATE INDEX "audit_log_actor_id_at_idx" ON "audit_log"("actor_id", "at" DESC);

-- login_attempts: nieudane proby logowania (klucze to HMAC e-maila i IP, nie jawne dane); okno i limit w API.
CREATE TABLE "login_attempts" (
    "id" BIGSERIAL NOT NULL,
    "email_hash" TEXT NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "login_attempts_email_hash_at_idx" ON "login_attempts"("email_hash", "at");
CREATE INDEX "login_attempts_ip_hash_at_idx" ON "login_attempts"("ip_hash", "at");

-- order_notes: notatki wewnetrzne (autor i czas), niewidoczne dla klienta.
CREATE TABLE "order_notes" (
    "id" BIGSERIAL NOT NULL,
    "order_number" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_notes_body_check" CHECK (char_length("body") BETWEEN 1 AND 1000)
);
CREATE INDEX "order_notes_order_number_at_idx" ON "order_notes"("order_number", "at");
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_order_number_fkey" FOREIGN KEY ("order_number") REFERENCES "orders"("number") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_notes" ADD CONSTRAINT "order_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
