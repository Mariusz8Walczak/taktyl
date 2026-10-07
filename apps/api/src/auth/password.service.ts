// B-001, B-005 (ADR-0006): hasla hashowane argon2id (@node-rs/argon2: gotowe binaria dla musl, dziala w node:22-alpine, API-008).
// Hasla nigdy nie sa logowane ani zapisywane jawnie.
import { Injectable } from "@nestjs/common";
import { hash, verify } from "@node-rs/argon2";

// Parametry wg zalecen OWASP dla argon2id (19 MiB, 2 przebiegi, 1 watek). `algorithm` pomijamy: domyslny jest Argon2id.
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

/** B-005, B-010: sila hasla. Zwraca liste problemow (puste = ok); komunikaty mowia, co poprawic. */
export function passwordProblems(password: string, email?: string): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH)
    problems.push(`Haslo musi miec co najmniej ${PASSWORD_MIN_LENGTH} znakow.`);
  if (password.length > PASSWORD_MAX_LENGTH)
    problems.push(`Haslo moze miec najwyzej ${PASSWORD_MAX_LENGTH} znakow.`);
  if (/CHANGE_ME/i.test(password)) problems.push("Zastap placeholder prawdziwym haslem.");
  if (email && password.toLowerCase() === email.toLowerCase())
    problems.push("Haslo nie moze byc takie samo jak adres e-mail.");
  if (new Set(password).size < 5) problems.push("Haslo jest zbyt powtarzalne.");
  return problems;
}

@Injectable()
export class PasswordService {
  /** Hash wzorcowy do wyrownania czasu odpowiedzi dla nieistniejacego konta (brak enumeracji, B-001). */
  private dummy: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  async verify(storedHash: string, password: string): Promise<boolean> {
    try {
      return await verify(storedHash, password);
    } catch {
      return false;
    }
  }

  /** Wykonuje te sama prace co weryfikacja prawdziwego hasla i zawsze zwraca false. */
  async verifyDummy(password: string): Promise<false> {
    this.dummy ??= this.hash("taktyl-dummy-password-not-a-credential");
    await this.verify(await this.dummy, password);
    return false;
  }
}
