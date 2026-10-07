// B-103: globalny modul konfiguracji (wartosci zwalidowane Zod, wstrzykiwane przez token APP_CONFIG).
import { Global, Module } from "@nestjs/common";
import { loadEnv } from "./env.js";

export const APP_CONFIG = Symbol("APP_CONFIG");

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadEnv(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
