// B-240 (docs/14 par. 12): pomocnicze funkcje testow integracyjnych API (Nest + supertest + PostgreSQL w kontenerze).
// Wymaga TEST_DATABASE_URL (baza po `prisma migrate deploy`); testy CZYSZCZA te baze (reset + seed).
import "reflect-metadata";
import { fileURLToPath } from "node:url";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import type { DestinationStream } from "pino";
import request from "supertest";
import { runSeed } from "../prisma/seed/run.js";
import { AppModule } from "../src/app.module.js";
import { configureApp } from "../src/app.setup.js";
import { CLOCK } from "../src/common/clock.js";
import { createLogger } from "../src/common/logger.js";
import { loadEnv } from "../src/config/env.js";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const hasDb = Boolean(TEST_DATABASE_URL);
/** Sroda 2026-10-07 12:00 w Warszawie: przed 14:00, wysylka tego samego dnia (docs/12 par. 2). */
export const NOW = new Date("2026-10-07T10:00:00Z");
/** Zmienne ustawiane tylko przez wybrane testy (czyszczone przy kazdym starcie aplikacji). */
const OPTIONAL_ENV = [
  "DEMO_MODE",
  "ADMIN_BOOTSTRAP_EMAIL",
  "ADMIN_BOOTSTRAP_PASSWORD",
  "SESSION_IDLE_MINUTES",
  "SESSION_TTL_HOURS",
  "SESSION_COOKIE_SECURE",
  "LOGIN_MAX_ATTEMPTS",
  "LOGIN_IP_MAX_ATTEMPTS",
  "LOGIN_WINDOW_MINUTES",
  "REVALIDATE_URL",
  "FORBIDDEN_BRANDS",
  "OUTBOX_WORKER_ENABLED",
  "OUTBOX_POLL_MS",
  "OUTBOX_BATCH_SIZE",
  "REVALIDATE_TIMEOUT_MS",
];
const root = fileURLToPath(new URL("../../../", import.meta.url));

export interface TestEnv {
  app: NestExpressApplication;
  prisma: PrismaClient;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

export async function reseed(prisma: PrismaClient): Promise<void> {
  await runSeed(prisma, { root, now: NOW, reset: true });
}

/** Startuje pelna aplikacje na bazie testowej; `rateLimit: true` wlacza throttling (domyslnie wylaczony w testach). */
export async function bootApp(
  options: {
    rateLimit?: boolean;
    seed?: boolean;
    now?: Date;
    openapi?: boolean;
    /** Dodatkowe zmienne srodowiska (np. DEMO_MODE, ADMIN_BOOTSTRAP_*); wartosci spoza listy sa czyszczone miedzy testami. */
    env?: Record<string, string>;
    /** Ruchomy zegar (testy wygasania sesji i blokady logowania); domyslnie stala chwila NOW. */
    clock?: () => Date;
    /** Przechwytywanie logow JSON (testy "brak hasel w logach"). */
    logSink?: DestinationStream;
  } = {},
): Promise<TestEnv> {
  const dbUrl = TEST_DATABASE_URL ?? "";
  for (const k of OPTIONAL_ENV) delete process.env[k];
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: dbUrl,
    SESSION_SECRET: "s".repeat(40),
    REVALIDATE_SECRET: "r".repeat(40),
    RATE_LIMIT_ENABLED: options.rateLimit ? "true" : "false",
    LOG_LEVEL: "fatal",
    API_CORS_ORIGINS: "http://taktyl.localhost",
    ...options.env,
  });
  const config = loadEnv(process.env);
  const prisma = new PrismaClient({ datasourceUrl: dbUrl });
  if (options.seed !== false) await reseed(prisma);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(options.clock ?? (() => options.now ?? NOW))
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(
    app,
    config,
    options.logSink
      ? createLogger("info", true, options.logSink)
      : createLogger("error", Boolean(process.env.TEST_LOG)),
  );
  await app.init();
  return {
    app,
    prisma,
    http: () => request(app.getHttpServer() as Parameters<typeof request>[0]),
    close: async () => {
      await app.close();
      await prisma.$disconnect();
    },
  };
}
