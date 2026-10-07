// B-103: start aplikacji (Express, Nest 11).
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { configureApp } from "./app.setup.js";
import { createLogger } from "./common/logger.js";
import { loadEnv } from "./config/env.js";

async function bootstrap(): Promise<void> {
  const config = loadEnv(process.env);
  const logger = createLogger(config.LOG_LEVEL);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  configureApp(app, config, logger);
  app.enableShutdownHooks();
  await app.listen(config.API_PORT, "0.0.0.0");
}

bootstrap().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
