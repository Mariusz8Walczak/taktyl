// B-060 (ADR-0003, docs/14 par. 6, docs/17 par. 3.6): zapis znacznikow rewalidacji do `outbox` w tej samej transakcji co zmiana.
// Wysylka jest osobno: OutboxWorker (po commicie, z ponawianiem). Tu tylko zapis i sygnal "pobudz worker".
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { CLOCK, type Clock } from "../common/clock.js";
import { isValidTag } from "./tags.js";

export interface TaggedProduct {
  slug: string;
  categoryId: string;
}

/** docs/14 par. 6, wiersz "Stan magazynowy wariantu": product:{slug}, category:{k}, facets:{k}. */
export function stockTags(products: readonly TaggedProduct[]): string[] {
  const tags = new Set<string>();
  for (const p of products) {
    tags.add(`product:${p.slug}`);
    tags.add(`category:${p.categoryId}`);
    tags.add(`facets:${p.categoryId}`);
  }
  return [...tags].sort();
}

/** Opoznienie pobudzenia: transakcja zdazy sie zatwierdzic, a bliskie zapisy trafiaja do jednego wywolania. */
export const WAKE_DELAY_MS = 150;

@Injectable()
export class OutboxService {
  private readonly listeners = new Set<() => void>();
  private wakeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  /**
   * B-060: wstawia wiersz `pending` w podanej transakcji (wolac W TEJ SAMEJ transakcji co mutacja). Znaczniki sa
   * deduplikowane i walidowane wzorcem z contracts (nieznany znacznik = blad programisty, transakcja sie wycofa).
   * Puste znaczniki nic nie zapisuja.
   */
  async enqueueTags(
    tx: Prisma.TransactionClient,
    tags: readonly string[],
    auditId?: bigint,
  ): Promise<void> {
    const unique = [...new Set(tags)].sort();
    if (unique.length === 0) return;
    const bad = unique.filter((t) => !isValidTag(t));
    if (bad.length > 0) throw new Error(`Nieznany znacznik rewalidacji: ${bad.join(", ")}`);
    const now = this.clock();
    await tx.outbox.create({
      data: {
        tags: unique,
        status: "pending",
        createdAt: now,
        nextAttemptAt: now,
        ...(auditId === undefined ? {} : { auditId }),
      },
    });
    this.scheduleWake();
  }

  /** Zgodnosc wsteczna z B-219 (zamowienia, platnosci, B-205). */
  enqueue(tx: Prisma.TransactionClient, tags: readonly string[], auditId?: bigint): Promise<void> {
    return this.enqueueTags(tx, tags, auditId);
  }

  /** Worker rejestruje funkcje pobudzenia; zwraca wyrejestrowanie. */
  onWake(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private scheduleWake(): void {
    if (this.listeners.size === 0 || this.wakeTimer) return;
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = null;
      for (const l of this.listeners) l();
    }, WAKE_DELAY_MS);
    this.wakeTimer.unref();
  }
}
