// B-103: klient Prisma jako usluga Nest (polaczenie przy starcie, zamkniecie przy wylaczeniu).
import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({ datasourceUrl: config.DATABASE_URL });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
