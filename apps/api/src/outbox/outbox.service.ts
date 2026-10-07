// B-219 (ADR-0003, docs/14 par. 6, docs/17 par. 3.6): zapis znacznikow rewalidacji do `outbox` w tej samej transakcji co zmiana.
// To jest TYLKO zapis zdarzenia (stub): wysylka webhooka HMAC, ponawianie i worker to TAKTYL-46 (RevalidationService).
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

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

@Injectable()
export class OutboxService {
  /** Wstawia wiersz `pending` w podanej transakcji; puste znaczniki nic nie zapisuja. */
  async enqueue(
    tx: Prisma.TransactionClient,
    tags: readonly string[],
    auditId?: bigint,
  ): Promise<void> {
    const unique = [...new Set(tags)];
    if (unique.length === 0) return;
    await tx.outbox.create({
      data: { tags: unique, status: "pending", ...(auditId === undefined ? {} : { auditId }) },
    });
  }
}
