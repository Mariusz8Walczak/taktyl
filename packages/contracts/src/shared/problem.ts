// docs/16 §1: blad RFC 9457 application/problem+json.
import { z } from "zod";

export const errorCodeSchema = z.enum([
  "validation_failed",
  "unauthorized",
  "forbidden",
  "csrf_invalid",
  "not_found",
  "conflict",
  "out_of_stock",
  "price_changed",
  "rate_limited",
  "idempotency_conflict",
  "invalid_transition",
  "internal_error",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const problemFieldErrorSchema = z.object({
  path: z.string(),
  code: z.string(),
  message: z.string(),
});

export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.int().min(400).max(599),
  code: errorCodeSchema,
  detail: z.string().optional(),
  /** = X-Request-Id */
  instance: z.string().optional(),
  errors: z.array(problemFieldErrorSchema).optional(),
});
export type Problem = z.infer<typeof problemSchema>;
export type ProblemFieldError = z.infer<typeof problemFieldErrorSchema>;

export const PROBLEM_CONTENT_TYPE = "application/problem+json";
