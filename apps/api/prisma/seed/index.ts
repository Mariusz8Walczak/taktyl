// B-102: wejscie CLI seeda. `db:seed` (idempotentny) i `db:reset-demo` (--reset: czysci dane i seeduje od nowa).
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "../../src/prisma/create-client.js";
import { runSeed } from "./run.js";

/** Idzie w gore od pliku, az znajdzie katalog z data/products.json (zrodlo i bundle w dist maja rozne glebokosci). */
function findRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "data", "products.json"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("Nie znaleziono katalogu z data/products.json (ustaw SEED_ROOT)");
}

async function main(): Promise<void> {
  const reset = process.argv.includes("--reset");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Brak DATABASE_URL");
  if (reset && process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "true") {
    throw new Error("reset-demo w srodowisku produkcyjnym wymaga DEMO_MODE=true");
  }
  const root = process.env.SEED_ROOT ?? findRoot();
  const now = process.env.SEED_NOW ? new Date(process.env.SEED_NOW) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error("SEED_NOW: niepoprawna data ISO");

  const prisma = createPrismaClient(url);
  try {
    await runSeed(prisma, { root, now, reset, log: (m) => console.log(`[seed] ${m}`) });
    console.log(reset ? "[seed] reset-demo zakonczony" : "[seed] seed zakonczony");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
