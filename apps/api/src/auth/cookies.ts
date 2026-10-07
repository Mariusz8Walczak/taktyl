// B-002 (docs/15): ciasteczko sesji HttpOnly; Secure (produkcja); SameSite=Strict. Bez cookie-parser: jedno ciasteczko, wlasny parser.
export const SESSION_COOKIE = "taktyl_session";

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      const value = part.slice(idx + 1).trim();
      return value === "" ? undefined : value;
    }
  }
  return undefined;
}

export interface CookieOptions {
  secure: boolean;
  domain?: string | undefined;
}

export function sessionCookie(token: string, maxAgeSeconds: number, opts: CookieOptions): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    "HttpOnly",
    "SameSite=Strict",
    ...(opts.secure ? ["Secure"] : []),
    ...(opts.domain ? [`Domain=${opts.domain}`] : []),
  ].join("; ");
}

/** Ciasteczko wygaszone (wylogowanie, sesja niewazna). */
export const clearedSessionCookie = (opts: CookieOptions): string => sessionCookie("", 0, opts);
