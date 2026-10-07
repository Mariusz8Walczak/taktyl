import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller.js";

describe("B-103 HealthController", () => {
  it("zwraca status ok", () => {
    expect(new HealthController().live()).toEqual({ status: "ok" });
  });
});
