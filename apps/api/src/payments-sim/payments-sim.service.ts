// F-177, F-178, F-179 (docs/16 par. 5, 6.3, ADR-0007): symulacja platnosci. Zero danych kart i kodow BLIK.
// `paid` zmniejsza stany w jednej transakcji z blokada wierszy (SELECT ... FOR UPDATE, sku rosnaco = bez zakleszczen).
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { paymentSimulateResponseSchema, type ProblemFieldError } from "@taktyl/contracts";
import { AppException } from "../common/app-exception.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { respond } from "../common/zod.pipe.js";
import { OrderAccessService } from "../orders/order-access.service.js";
import { OutboxService, stockTags } from "../outbox/outbox.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

type Outcome = "paid" | "failed";
const PAYABLE = ["pending_payment", "payment_failed"];
const ALREADY_PAID = ["paid", "processing", "shipped", "delivered"];

@Injectable()
export class PaymentsSimService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OrderAccessService) private readonly access: OrderAccessService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async simulate(number: string, tokenHeader: string | undefined, outcome: Outcome) {
    await this.access.authorize(number, tokenHeader);
    const status = await this.prisma.$transaction((tx) => this.run(tx, number, outcome));
    return respond(paymentSimulateResponseSchema, { status, transaction_id: number });
  }

  private async run(
    tx: Prisma.TransactionClient,
    number: string,
    outcome: Outcome,
  ): Promise<"paid" | "payment_failed"> {
    const now = this.clock();
    // Blokada zamowienia: rownolegle symulacje tego samego numeru ustawiaja sie w kolejce (idempotencja `paid`).
    const rows = await tx.$queryRaw<
      { status: string }[]
    >`SELECT status FROM orders WHERE number = ${number} FOR UPDATE`;
    const current = rows[0]?.status;
    if (current === undefined)
      throw new AppException(404, "not_found", "Nie znaleziono zamowienia.");

    if (outcome === "failed") {
      if (!PAYABLE.includes(current)) this.invalid(current, "payment_failed");
      await this.setPayment(tx, number, "failed", now);
      if (current !== "payment_failed")
        await this.transition(tx, number, current, "payment_failed", now);
      await tx.order.update({ where: { number }, data: { status: "payment_failed" } });
      return "payment_failed";
    }

    if (ALREADY_PAID.includes(current)) return "paid";
    if (!PAYABLE.includes(current)) this.invalid(current, "paid");
    if (current === "payment_failed") {
      await this.transition(tx, number, "payment_failed", "pending_payment", now, "ponowna proba");
    }

    const items = await tx.orderItem.findMany({
      where: { orderNumber: number },
      orderBy: { id: "asc" },
    });
    const demand = new Map<string, number>();
    for (const i of items) demand.set(i.sku, (demand.get(i.sku) ?? 0) + i.qty);
    const skus = [...demand.keys()].sort();
    const locked = await tx.$queryRaw<{ sku: string; stock: number }[]>`
      SELECT sku, stock FROM variants WHERE sku = ANY(${skus}) ORDER BY sku FOR UPDATE`;
    const stock = new Map(locked.map((r) => [r.sku, r.stock]));

    const errors: ProblemFieldError[] = [];
    items.forEach((i, idx) => {
      const have = stock.get(i.sku) ?? 0;
      if ((demand.get(i.sku) ?? 0) > have) {
        errors.push({
          path: `items[${idx}].sku`,
          code: "out_of_stock",
          message: `${i.sku}: dostepne ${have}`,
        });
      }
    });
    if (errors.length > 0) {
      // Wyjatek wycofuje transakcje: stany i status zamowienia zostaja bez zmian.
      throw new AppException(409, "out_of_stock", "Stan magazynowy zmienil sie w trakcie.", errors);
    }

    for (const sku of skus) {
      const qty = demand.get(sku) as number;
      const updated = await tx.variant.updateMany({
        where: { sku, stock: { gte: qty } },
        data: { stock: { decrement: qty }, version: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new AppException(409, "out_of_stock", "Stan magazynowy zmienil sie w trakcie.");
      await tx.stockMovement.create({
        data: {
          sku,
          delta: -qty,
          stockAfter: (stock.get(sku) as number) - qty,
          kind: "sale",
          orderNumber: number,
          actor: "system",
          at: now,
        },
      });
    }

    await this.setPayment(tx, number, "paid", now);
    await tx.order.update({ where: { number }, data: { status: "paid", paidAt: now } });
    await this.transition(tx, number, "pending_payment", "paid", now);

    // Stan wariantu zmienia karty i listingi produktow (docs/14 par. 6); tylko zapis zdarzenia, wysylka: TAKTYL-46.
    const products = await tx.variant.findMany({
      where: { sku: { in: skus } },
      select: { product: { select: { slug: true, categoryId: true } } },
    });
    await this.outbox.enqueue(tx, stockTags(products.map((p) => p.product)));
    return "paid";
  }

  private async setPayment(
    tx: Prisma.TransactionClient,
    number: string,
    status: "paid" | "failed",
    now: Date,
  ): Promise<void> {
    await tx.payment.update({
      where: { orderNumber: number },
      data: { status, attempts: { increment: 1 }, lastAttemptAt: now },
    });
  }

  private async transition(
    tx: Prisma.TransactionClient,
    number: string,
    from: string,
    to: string,
    now: Date,
    note?: string,
  ): Promise<void> {
    await tx.orderStatusHistory.create({
      data: {
        orderNumber: number,
        fromStatus: from,
        toStatus: to,
        actor: "system",
        at: now,
        note: note ?? null,
      },
    });
  }

  private invalid(from: string, to: string): never {
    throw new AppException(
      409,
      "invalid_transition",
      `Przejscie ${from} -> ${to} jest niedozwolone.`,
    );
  }
}
