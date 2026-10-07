// B-060 (ADR-0003, docs/16 par. 3.6): klient webhooka rewalidacji api -> web z podpisem HMAC-SHA256.
// Adres wylacznie z env (A10 SSRF), brak sekretow w bledach i logach.
import { Inject, Injectable } from "@nestjs/common";
import { revalidateResponseSchema } from "@taktyl/contracts";
import { CLOCK, type Clock } from "../common/clock.js";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";
import { SIGNATURE_HEADER, signPayload, TIMESTAMP_HEADER } from "./signature.js";

export class RevalidationError extends Error {}

@Injectable()
export class RevalidationService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.REVALIDATE_URL);
  }

  /** Wysyla jedno wywolanie (<= 50 znacznikow). Wyjatek `RevalidationError` = ponow pozniej. */
  async send(tags: readonly string[]): Promise<string[]> {
    const url = this.config.REVALIDATE_URL;
    if (!url) throw new RevalidationError("REVALIDATE_URL nie jest ustawiony");
    const body = JSON.stringify({ tags });
    const timestamp = Math.floor(this.clock().getTime() / 1000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [TIMESTAMP_HEADER]: String(timestamp),
          [SIGNATURE_HEADER]: signPayload(this.config.REVALIDATE_SECRET, timestamp, body),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(this.config.REVALIDATE_TIMEOUT_MS),
      });
    } catch (e) {
      const reason =
        e instanceof Error ? (e.cause instanceof Error ? e.cause.message : e.message) : "blad";
      throw new RevalidationError(`Brak odpowiedzi sklepu: ${reason}`.slice(0, 300));
    }
    if (res.status !== 200) throw new RevalidationError(`Sklep odpowiedzial HTTP ${res.status}`);
    const parsed = revalidateResponseSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new RevalidationError("Sklep zwrocil niepoprawna odpowiedz");
    return parsed.data.revalidated;
  }
}
