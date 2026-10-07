// I-008 (TAKTYL-75, ADR-0010): konfiguracja Prisma 7 - sciezki schematu i migracji oraz adres bazy dla CLI
// (migrate deploy). Prisma 7 nie wczytuje juz .env sama: adres bazy pochodzi ze zmiennej srodowiska kontenera.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // `prisma generate` nie laczy sie z baza; zastepczy adres tylko tam, gdzie DATABASE_URL nie jest ustawione.
    url: process.env.DATABASE_URL ?? "postgresql://generate-only@localhost:5432/none",
  },
});
