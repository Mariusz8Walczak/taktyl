// B-102: wejscie CLI seeda. `db:seed` (idempotentny) i `db:reset-demo` (--reset: czysci dane i seeduje od nowa).
import { randomUUID } from "node:crypto";
import { createPrismaClient } from "../../src/prisma/create-client.js";
import { findSeedRoot } from "./root.js";
import { runSeed } from "./run.js";

async function main(): Promise<void> {
  const reset = process.argv.includes("--reset");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Brak DATABASE_URL");
  if (reset && process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "true") {
    throw new Error("reset-demo w srodowisku produkcyjnym wymaga DEMO_MODE=true");
  }
  const root = findSeedRoot(import.meta.url);
  const now = process.env.SEED_NOW ? new Date(process.env.SEED_NOW) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error("SEED_NOW: niepoprawna data ISO");

  const prisma = createPrismaClient(url);
  try {
    await runSeed(prisma, {
      root,
      now,
      reset,
      // I-009 (B-014): reset z CLI/petli reset-demo zostawia wpis demo.reset i odswieza sklep przez outbox.
      ...(reset
        ? { notify: { actorId: null, actorRole: "system" as const, requestId: `reset-${randomUUID()}` } }
        : {}),
      log: (m) => console.log(`[seed] ${m}`),
    });
    console.log(reset ? "[seed] reset-demo zakonczony" : "[seed] seed zakonczony");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
