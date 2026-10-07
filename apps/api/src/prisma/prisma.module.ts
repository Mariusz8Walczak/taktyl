// B-103: globalny modul Prisma.
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service.js";

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
