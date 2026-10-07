// B-014 (docs/15 par. 6, docs/16, ADR-0006), I-009 (TAKTYL-65): reset danych demo z backpanelu (tylko owner i DEMO_MODE=true).
import { z } from "zod";
import { dateTimeSchema } from "../shared/primitives";

/** POST /v1/admin/demo/reset: potwierdzenie wpisaniem slowa "reset" (UI nie uzywa confirm()). */
export const demoResetRequestSchema = z.strictObject({ confirm: z.literal("reset") });
export const demoResetResponseSchema = z.object({ status: z.literal("reset"), at: dateTimeSchema });
export type DemoResetResponse = z.infer<typeof demoResetResponseSchema>;
