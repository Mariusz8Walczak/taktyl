// B-230: liveness bez zaleznosci; readiness testuje health.e2e.test.ts na PostgreSQL.
import { describe, expect, it } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { HealthController } from "./health.controller.js";

describe("B-230 HealthController", () => {
  it("liveness zwraca status ok bez dotykania bazy", () => {
    expect(new HealthController(null as unknown as PrismaService).live()).toEqual({ status: "ok" });
  });
});
