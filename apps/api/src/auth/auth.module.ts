// B-001..B-009: modul uwierzytelniania backpanelu. Guard `AdminAuthGuard` jest globalny (APP_GUARD) i dziala tylko na /v1/admin/*.
import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AdminAuthGuard } from "./admin-auth.guard.js";
import { AdminRoutesCheck } from "./admin-routes.check.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { BootstrapService } from "./bootstrap.service.js";
import { LoginThrottleService } from "./login-throttle.service.js";
import { PasswordService } from "./password.service.js";
import { SessionService } from "./session.service.js";

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    PasswordService,
    LoginThrottleService,
    BootstrapService,
    AdminRoutesCheck,
    { provide: APP_GUARD, useClass: AdminAuthGuard },
  ],
  exports: [SessionService, PasswordService, AuthService],
})
export class AuthModule {}
