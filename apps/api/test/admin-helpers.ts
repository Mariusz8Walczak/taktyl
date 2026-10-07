// B-001, B-006 (TAKTYL-45): pomocnicze funkcje testow backpanelu (konta, logowanie, sprzatanie tabel auth).
import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import type { PrismaClient } from "../src/prisma/client.js";
import { expect } from "vitest";
import type { TestEnv } from "./helpers.js";

/** Hasla testowe sa losowe przy kazdym przebiegu: w repozytorium nie ma zadnych poswiadczen (ADR-0006). */
export const pw = () => `Aa1-${randomBytes(12).toString("hex")}`;

export async function resetAuth(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "audit_log", "outbox" RESTART IDENTITY`);
  await prisma.$executeRawUnsafe(`DELETE FROM "sessions"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "login_attempts"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "admin_users"`);
}

export async function addUser(
  prisma: PrismaClient,
  email: string,
  role: "owner" | "editor" | "viewer",
  password: string,
) {
  return prisma.adminUser.create({
    data: { email, role, active: true, passwordHash: await hash(password) },
  });
}

export interface LoggedIn {
  cookie: string;
  csrf: string;
  setCookie: string;
}

export async function login(
  t: TestEnv,
  email: string,
  password: string,
  ip = "10.1.0.1",
): Promise<LoggedIn> {
  const res = await t
    .http()
    .post("/v1/admin/auth/login")
    .set("X-Forwarded-For", ip)
    .send({ email, password });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const setCookie = (res.headers["set-cookie"] as unknown as string[])[0] as string;
  return {
    cookie: setCookie.split(";")[0] as string,
    csrf: (res.body as { csrf_token: string }).csrf_token,
    setCookie,
  };
}
