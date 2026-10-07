// B-103: start aplikacji. Helmet, throttling i CORS dokladaja TAKTYL-22.
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { loadEnv } from "./config/env.js";

async function bootstrap(): Promise<void> {
  const config = loadEnv(process.env);
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(config.API_PORT, "0.0.0.0");
}

bootstrap().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
