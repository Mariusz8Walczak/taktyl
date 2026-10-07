// B-001 (docs/16 §3.1, ADR-0006): sesja i uzytkownicy backpanelu. Haslo wystepuje tylko tu (Q-02), nigdy w sklepie.
import { z } from "zod";
import { roleSchema } from "../shared/enums";
import { dateTimeSchema, emailSchema } from "../shared/primitives";

export const loginRequestSchema = z.strictObject({ email: emailSchema, password: z.string().min(1).max(200) });

export const adminUserSchema = z.object({
  id: z.string(), email: emailSchema, role: roleSchema, active: z.boolean(),
  last_login_at: dateTimeSchema.nullable(), created_at: dateTimeSchema,
});
export type AdminUser = z.infer<typeof adminUserSchema>;

/** POST /auth/login, POST /auth/demo-viewer, GET /auth/me. */
export const sessionResponseSchema = z.object({
  user: adminUserSchema.pick({ id: true, email: true, role: true }),
  csrf_token: z.string().min(16),
  demo: z.boolean().optional(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const createUserRequestSchema = z.strictObject({
  email: emailSchema, role: roleSchema, initial_password: z.string().min(12).max(200),
});
export const updateUserRequestSchema = z
  .strictObject({
    role: roleSchema.optional(), active: z.boolean().optional(),
    /** reset hasla: serwer zwraca haslo tymczasowe jednorazowo */
    reset_password: z.literal(true).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "pusty PATCH");
/** PATCH /users/{id}: przy reset_password serwer zwraca haslo tymczasowe jednorazowo (nie jest zapisywane w dzienniku). */
export const updateUserResponseSchema = adminUserSchema.extend({ temporary_password: z.string().min(12).optional() });
export const usersResponseSchema = z.object({ items: z.array(adminUserSchema) });
