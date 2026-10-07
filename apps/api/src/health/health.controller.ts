// B-103: liveness (/health). Readiness z kontrola bazy (/health/ready) dodaje TAKTYL-22.
import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  live(): { status: "ok" } {
    return { status: "ok" };
  }
}
