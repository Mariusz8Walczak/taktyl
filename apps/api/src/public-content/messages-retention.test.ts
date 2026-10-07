// F-221, F-223 (docs/17 par. 9): retencja zgloszen z formularzy - harmonogram na falszywych zegarach i granica 30 dni (bez bazy).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../config/env.js";
import {
  MESSAGES_RETENTION_INTERVAL_MS,
  MessagesRetentionService,
} from "./messages-retention.service.js";

const DAY = 86_400_000;
const START = new Date("2026-10-07T10:00:00Z");

function setup(nodeEnv: AppConfig["NODE_ENV"], retentionDays = 30) {
  const deleted: { table: string; cutoff: Date }[] = [];
  const audits: unknown[] = [];
  const tx = {
    contactMessage: {
      deleteMany: vi.fn(({ where }: { where: { createdAt: { lt: Date } } }) => {
        deleted.push({ table: "contact", cutoff: where.createdAt.lt });
        return Promise.resolve({ count: 2 });
      }),
    },
    newsletterSignup: {
      deleteMany: vi.fn(({ where }: { where: { createdAt: { lt: Date } } }) => {
        deleted.push({ table: "newsletter", cutoff: where.createdAt.lt });
        return Promise.resolve({ count: 1 });
      }),
    },
  };
  const audit = {
    withAudit: vi.fn(
      (_ctx: unknown, work: (tx: unknown, a: (e: unknown) => Promise<void>) => unknown) =>
        work(tx, (e) => {
          audits.push(e);
          return Promise.resolve();
        }),
    ),
  };
  const clock = vi.fn(() => new Date());
  const svc = new MessagesRetentionService(
    {} as never,
    audit as never,
    { NODE_ENV: nodeEnv, MESSAGE_RETENTION_DAYS: retentionDays } as AppConfig,
    clock,
  );
  return { svc, deleted, audits, audit };
}

describe("F-221, F-223 retencja zgloszen (fake timers)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("granica to dokladnie N dni od chwili zegara; wpis audytu ma tylko liczby i date", async () => {
    const { svc, deleted, audits } = setup("production", 30);
    expect(await svc.purge()).toEqual({ contact: 2, newsletter: 1 });
    expect(deleted.map((d) => d.cutoff.getTime())).toEqual([
      START.getTime() - 30 * DAY,
      START.getTime() - 30 * DAY,
    ]);
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits)).toMatch(/"contact":2,"newsletter":1/);
    expect(JSON.stringify(audits)).not.toMatch(/@|email/);
  });

  it("poza testami uruchamia zadanie przy starcie i co 6 godzin, a zamkniecie zatrzymuje zegar", async () => {
    const { svc, audit } = setup("production");
    svc.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    expect(audit.withAudit).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(MESSAGES_RETENTION_INTERVAL_MS);
    expect(audit.withAudit).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3 * MESSAGES_RETENTION_INTERVAL_MS);
    expect(audit.withAudit).toHaveBeenCalledTimes(5);
    svc.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(2 * MESSAGES_RETENTION_INTERVAL_MS);
    expect(audit.withAudit).toHaveBeenCalledTimes(5);
  });

  it("kolejne uruchomienia przesuwaja date graniczna razem z zegarem", async () => {
    const { svc, deleted } = setup("production", 30);
    await svc.purge();
    vi.setSystemTime(new Date(START.getTime() + 2 * DAY));
    await svc.purge();
    expect(deleted[2]?.cutoff.getTime()).toBe(START.getTime() + 2 * DAY - 30 * DAY);
  });

  it("w srodowisku test nie uruchamia zegara w tle", async () => {
    const { svc, audit } = setup("test");
    svc.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(2 * MESSAGES_RETENTION_INTERVAL_MS);
    expect(audit.withAudit).not.toHaveBeenCalled();
  });
});
