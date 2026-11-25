-- B-621, B-622 (ADR-0012): kolektor zdarzen pomiaru z docs/10 i znacznik danych demonstracyjnych.
-- Zdarzenia: anonimowy session_id, nazwa i parametry bez zmian z docs/10, bez danych osobowych i bez adresu IP.
CREATE TABLE "analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "ts" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_events_ts_idx" ON "analytics_events"("ts");
CREATE INDEX "analytics_events_name_ts_idx" ON "analytics_events"("name", "ts");
CREATE INDEX "analytics_events_session_id_ts_idx" ON "analytics_events"("session_id", "ts");

ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_session_id_check" CHECK ("session_id" ~ '^[A-Za-z0-9_-]{8,64}$');

-- B-622: zamowienia z generatora historii demo (ok. 90 dni) sa oznaczone, zeby pulpit mogl to powiedziec wprost.
ALTER TABLE "orders" ADD COLUMN "demo" BOOLEAN NOT NULL DEFAULT false;
