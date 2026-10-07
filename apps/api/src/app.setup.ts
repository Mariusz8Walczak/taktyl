// B-103, B-210, B-213 (docs/14 par. 7-8): wspolna konfiguracja aplikacji (main.ts i testy e2e):
// prefiks /v1, requestId i log JSON, filtr problem+json, CORS z listy zrodel.
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import type { Logger } from "pino";
import { ProblemFilter } from "./common/problem.filter.js";
import { requestContext } from "./common/request-context.js";
import { PinoNestLogger } from "./common/logger.js";
import type { AppConfig } from "./config/env.js";

/** Sciezki poza `/v1` (docs/16 par. 2): liveness, readiness, dokumentacja. */
export const UNVERSIONED_ROUTES = [
  "health",
  "health/ready",
  "ready",
  "docs",
  "openapi.json",
  "v1/openapi.json",
];

export function configureApp(app: NestExpressApplication, config: AppConfig, logger: Logger): void {
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.useLogger(new PinoNestLogger(logger));
  app.use(requestContext(logger));
  // API zwraca JSON (i prosta strone /docs bez skryptow i stylow): CSP bez zadnych zrodel, bez ramek (docs/14 par. 7 A05).
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      referrerPolicy: { policy: "no-referrer" },
    }),
  );
  app.setGlobalPrefix("v1", { exclude: UNVERSIONED_ROUTES });
  app.useGlobalFilters(new ProblemFilter(logger));
  app.enableCors({
    origin: config.API_CORS_ORIGINS,
    // B-002, B-003: backpanel (inna domena tej samej witryny) wysyla ciasteczko sesji i naglowek CSRF.
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Idempotency-Key",
      "X-Order-Token",
      "X-Request-Id",
      "If-None-Match",
      "If-Match",
      "X-CSRF-Token",
    ],
    exposedHeaders: ["X-Request-Id", "ETag", "Retry-After"],
    maxAge: 600,
  });
}
