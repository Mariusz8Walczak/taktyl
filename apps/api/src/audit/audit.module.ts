// B-011, B-012: modul dziennika zmian. Globalny, bo kazdy modul mutujacy dane admina zapisuje wpisy (withAudit).
import { Global, Module } from "@nestjs/common";
import { AuditController } from "./audit.controller.js";
import { AuditService } from "./audit.service.js";

@Global()
@Module({ controllers: [AuditController], providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
