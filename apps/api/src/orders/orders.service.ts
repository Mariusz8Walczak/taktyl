// F-170...F-176, F-178, F-180, F-201, F-202 (docs/16 par. 6.2, ADR-0007): zamowienia.
// API nie ufa klientowi: ponowna wycena z bazy (domena), kwoty z `expected_total_gr` tylko porownywane.
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../prisma/client.js";
import {
  orderCreatedSchema,
  orderListSchema,
  type OrderCreated,
  type OrderDetail,
  type OrderRequest,
  type ProblemFieldError,
} from "@taktyl/contracts";
import { computeDispatch, isValidNip } from "@taktyl/domain";
import { AppException, validationFailed } from "../common/app-exception.js";
import { canonicalJson, sha256Hex } from "../common/canonical-json.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { deriveOrderToken, hashOrderToken } from "../common/order-token.js";
import { respond } from "../common/zod.pipe.js";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";
import { CartQuoteService, type QuoteComputation } from "../cart-quote/cart-quote.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { generateOrderNumber } from "../common/order-number.js";
import { OrderAccessService } from "./order-access.service.js";
import { type OrderWithItems, toOrderDetail } from "./order-detail.js";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const NUMBER_RETRIES = 5;

type StoredBody = Omit<OrderCreated, "order_token">;

function isUniqueViolation(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// I-008 (Prisma 7, adapter pg): meta.target znika, informacja o naruszonym ograniczeniu jest w
// meta.driverAdapterError.cause.constraint ({ fields } albo { index }), a nazwa modelu w meta.modelName.
function targetOf(e: Prisma.PrismaClientKnownRequestError): string {
  const meta = (e.meta ?? {}) as {
    target?: unknown;
    modelName?: string;
    driverAdapterError?: {
      cause?: { constraint?: { fields?: string[]; index?: string } };
    };
  };
  if (meta.target !== undefined) {
    return Array.isArray(meta.target) ? meta.target.join(",") : String(meta.target);
  }
  const constraint = meta.driverAdapterError?.cause?.constraint;
  const fields = constraint?.fields?.join(",") ?? constraint?.index ?? "";
  return fields || meta.modelName || "";
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CartQuoteService) private readonly quotes: CartQuoteService,
    @Inject(OrderAccessService) private readonly access: OrderAccessService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** F-170, F-171, F-172, F-173, F-174, F-175, F-176, F-180: utworzenie zamowienia `pending_payment`. */
  async create(body: OrderRequest, idempotencyKey: string): Promise<OrderCreated> {
    const requestHash = sha256Hex(canonicalJson(body));
    const replay = await this.findReplay(idempotencyKey, requestHash);
    if (replay) return replay;

    await this.validateBusinessRules(body);
    const q = await this.quotes.compute({
      items: body.items,
      coupon: body.coupon,
      shippingMethod: body.shipping.method,
    });
    this.rejectUnfulfillable(q);
    if (q.quote.total !== body.expected_total_gr) {
      throw new AppException(
        409,
        "price_changed",
        `Serwer wyliczyl sume ${q.quote.total} gr, klient podal ${body.expected_total_gr} gr.`,
        [
          {
            path: "expected_total_gr",
            code: "price_changed",
            message: `Aktualna suma: ${q.quote.total} gr.`,
          },
        ],
      );
    }

    const method = q.config.shippingMethods.find((m) => m.id === body.shipping.method);
    const dispatch = computeDispatch(q.now, {
      cutoffHour: q.config.dispatchCutoffHour,
      timeZone: q.config.timeZone,
      etaBusinessDays: method?.etaBusinessDays ?? 0,
    });
    const code = q.quote.codeStatus === "applied" ? (body.coupon ?? "").trim().toUpperCase() : null;
    const shippingGr = q.quote.shipping ?? 0;

    for (let attempt = 0; attempt < NUMBER_RETRIES; attempt++) {
      const number = generateOrderNumber(q.now);
      const items = this.orderItemRows(q, number);
      const token = deriveOrderToken(this.config.SESSION_SECRET, number, idempotencyKey);
      const stored: StoredBody = {
        number,
        status: "pending_payment",
        currency: "PLN",
        items_total_gr: q.quote.afterDiscounts,
        shipping_gr: shippingGr,
        total_gr: q.quote.total,
        payment: { type: body.payment_type, simulate_url: `/zamowienie/platnosc?id=${number}` },
        eta: { dispatch_date: dispatch.dispatchIso, delivery_date: dispatch.deliveryIso },
      };
      try {
        await this.prisma.$transaction([
          this.prisma.order.create({
            data: {
              number,
              status: "pending_payment",
              orderTokenHash: hashOrderToken(token),
              idempotencyKey,
              contactEmail: body.contact.email,
              contactPhone: body.contact.phone,
              shippingMethodId: body.shipping.method,
              shippingAddress: this.address(body.shipping),
              invoice: body.invoice ? { ...body.invoice } : Prisma.DbNull,
              paymentType: body.payment_type,
              couponCode: code,
              itemsGr: q.quote.productsValue,
              setDiscountGr: q.quote.setDiscount,
              couponDiscountGr: q.quote.codeDiscount,
              shippingGr,
              totalGr: q.quote.total,
              consents: { terms: true, newsletter: body.consents.newsletter },
              dispatchDate: new Date(`${dispatch.dispatchIso}T00:00:00Z`),
              deliveryDate: new Date(`${dispatch.deliveryIso}T00:00:00Z`),
              createdAt: q.now,
              items: { create: items },
              statusHistory: {
                create: {
                  fromStatus: null,
                  toStatus: "pending_payment",
                  actor: "system",
                  at: q.now,
                },
              },
              payment: {
                create: {
                  type: body.payment_type,
                  amountGr: q.quote.total,
                  status: "created",
                  attempts: 0,
                },
              },
            },
          }),
          this.prisma.idempotencyKey.create({
            data: {
              key: idempotencyKey,
              requestHash,
              responseStatus: 201,
              responseBody: stored as unknown as Prisma.InputJsonValue,
              createdAt: q.now,
              expiresAt: new Date(q.now.getTime() + IDEMPOTENCY_TTL_MS),
            },
          }),
        ]);
        return respond(orderCreatedSchema, { ...stored, order_token: token });
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        const target = targetOf(e);
        if (target === "key" || target.includes("idempotency")) {
          // Rownolegle zadanie z tym samym kluczem wygralo wyscig: odtwarzamy jego odpowiedz.
          const raced = await this.findReplay(idempotencyKey, requestHash);
          if (raced) return raced;
        }
        // Kolizja numeru zamowienia: losujemy kolejny.
      }
    }
    throw new AppException(
      500,
      "internal_error",
      "Nie udalo sie wygenerowac unikalnego numeru zamowienia.",
    );
  }

  /** Ten sam klucz + to samo cialo = ta sama odpowiedz (24 h); inne cialo = 409 idempotency_conflict. */
  private async findReplay(key: string, requestHash: string): Promise<OrderCreated | null> {
    const now = this.clock();
    const row = await this.prisma.idempotencyKey.findUnique({ where: { key } });
    if (row && row.expiresAt > now) {
      if (row.requestHash !== requestHash) {
        throw new AppException(
          409,
          "idempotency_conflict",
          "Ten Idempotency-Key zostal uzyty z innym cialem zadania.",
        );
      }
      const stored = row.responseBody as unknown as StoredBody;
      return respond(orderCreatedSchema, {
        ...stored,
        order_token: deriveOrderToken(this.config.SESSION_SECRET, stored.number, key),
      });
    }
    if (row)
      await this.prisma.idempotencyKey.deleteMany({ where: { key, expiresAt: { lte: now } } });
    // Klucz wygasl, ale zamowienie z nim istnieje: klucz jest "zuzyty" (jedno zamowienie na klucz).
    const spent = await this.prisma.order.findUnique({
      where: { idempotencyKey: key },
      select: { number: true },
    });
    if (spent) {
      throw new AppException(
        409,
        "idempotency_conflict",
        "Ten Idempotency-Key zostal juz uzyty (wygasl).",
      );
    }
    return null;
  }

  /** F-171, F-172, F-173, F-174, F-175: pola zalezne od metody dostawy, punkt, NIP, platnosc. */
  private async validateBusinessRules(body: OrderRequest): Promise<void> {
    const errors: ProblemFieldError[] = [];
    const [method, payment] = await Promise.all([
      this.prisma.shippingMethod.findFirst({ where: { id: body.shipping.method, active: true } }),
      this.prisma.paymentMethod.findFirst({ where: { id: body.payment_type, active: true } }),
    ]);
    if (!method) {
      errors.push({
        path: "shipping.method",
        code: "inactive",
        message: "Metoda dostawy jest niedostepna.",
      });
    } else {
      const provided = new Set<string>(["email", "phone", ...Object.keys(body.shipping)]);
      for (const field of method.fields) {
        if (!provided.has(field)) {
          errors.push({
            path: `shipping.${field}`,
            code: "required",
            message: "Pole wymagane dla tej metody dostawy.",
          });
        }
      }
    }
    if (body.shipping.method === "automat") {
      const point = await this.prisma.pickupPoint.findFirst({
        where: { id: body.shipping.point, active: true },
      });
      if (!point)
        errors.push({
          path: "shipping.point",
          code: "unknown_point",
          message: "Nieznany punkt odbioru.",
        });
    }
    if (!payment)
      errors.push({
        path: "payment_type",
        code: "inactive",
        message: "Metoda platnosci jest niedostepna.",
      });
    if (body.invoice && !isValidNip(body.invoice.nip)) {
      errors.push({
        path: "invoice.nip",
        code: "invalid_nip",
        message: "Niepoprawny NIP (suma kontrolna).",
      });
    }
    if (errors.length > 0) throw validationFailed(errors);
  }

  /** 422 dla nieznanego SKU, 409 out_of_stock z lista SKU (errors[].path = items[n].sku). */
  private rejectUnfulfillable(q: QuoteComputation): void {
    if (q.unknown.length > 0) {
      throw validationFailed(
        q.unknown.map((u) => ({
          path: `items[${u.sourceIndex}]`,
          code: "unknown_sku",
          message: `Nieznany SKU: ${u.sku}`,
        })),
      );
    }
    if (q.shortages.length === 0) return;
    const errors: ProblemFieldError[] = [];
    for (const s of q.shortages) {
      for (const { entry, sourceIndex } of q.entries) {
        if (entry.type === "item" && entry.sku === s.sku) {
          errors.push({
            path: `items[${sourceIndex}].sku`,
            code: "out_of_stock",
            message: `${s.sku}: dostepne ${s.availableQty}`,
          });
        } else if (entry.type === "set") {
          entry.items.forEach((i, idx) => {
            if (i.sku === s.sku) {
              errors.push({
                path: `items[${sourceIndex}].skus[${idx}]`,
                code: "out_of_stock",
                message: `${s.sku}: dostepne ${s.availableQty}`,
              });
            }
          });
        }
      }
    }
    throw new AppException(409, "out_of_stock", "Brak towaru dla czesci pozycji.", errors);
  }

  /** order_items: rozbicie rabatow wg domeny (rabat setu: reszta groszy na ostatnia pozycje); kwoty wiersza = ilosc x jednostka. */
  private orderItemRows(
    q: QuoteComputation,
    number: string,
  ): Prisma.OrderItemCreateWithoutOrderInput[] {
    const rows: Prisma.OrderItemCreateWithoutOrderInput[] = [];
    q.quote.lines.forEach((line, i) => {
      const entry = q.entries[i]?.entry;
      for (const item of line.items) {
        const found = q.index.get(item.sku);
        // Id z numeru i pozycji: sortowanie po id zachowuje kolejnosc koszyka (brak kolumny pozycji w docs/17).
        const base = {
          id: `${number}-${String(rows.length + 1).padStart(2, "0")}`,
          name: found?.product.name ?? item.sku,
          variantLabel: this.variantLabel(q, item.sku),
          qty: line.qty,
          unitPriceGr: item.price,
        };
        if (line.type === "set") {
          rows.push({
            ...base,
            groupId: entry?.type === "set" ? entry.id : null,
            setDiscountGr: item.discount * line.qty,
            couponDiscountGr: 0,
            variant: { connect: { sku: item.sku } },
          });
        } else {
          rows.push({
            ...base,
            groupId: null,
            setDiscountGr: 0,
            couponDiscountGr: line.codeDiscount,
            variant: { connect: { sku: item.sku } },
          });
        }
      }
    });
    return rows;
  }

  /** "Grafit · Prog" / "Grafit · M": etykiety z katalogu (docs/04 par. 8). */
  private variantLabel(q: QuoteComputation, sku: string): string {
    const found = q.index.get(sku);
    if (!found) return sku;
    const { variant, product } = found;
    const parts = [q.snapshot.colors[variant.color]?.label ?? variant.color];
    if (variant.switch !== undefined) {
      parts.push(q.snapshot.switches.find((s) => s.id === variant.switch)?.name ?? variant.switch);
    }
    if (variant.size !== undefined) {
      parts.push(product.attributes.sizes?.[variant.size]?.label ?? variant.size.toUpperCase());
    }
    return parts.join(" · ");
  }

  private address(s: OrderRequest["shipping"]): Prisma.InputJsonValue {
    if (s.method === "automat") return { point: s.point };
    if (s.method === "kurier")
      return { name: s.name, street: s.street, postcode: s.postcode, city: s.city };
    return { name: s.name };
  }

  /** F-178, F-202: odczyt zamowienia wlasciciela tokenu. */
  async get(number: string, tokenHeader: string | undefined): Promise<OrderDetail> {
    const order = await this.access.authorize(number, tokenHeader);
    const full = await this.prisma.order.findUniqueOrThrow({
      where: { number: order.number },
      include: { items: { orderBy: { id: "asc" } }, payment: true },
    });
    return this.detail(full);
  }

  /** F-201, F-202: lista zamowien dla "konta demo" (jeden lub wiele tokenow). */
  async list(tokenHeader: string | undefined) {
    const hashes = this.access.hashes(tokenHeader);
    const orders = await this.prisma.order.findMany({
      where: { orderTokenHash: { in: hashes }, createdAt: { gte: this.access.tokenCutoff() } },
      include: { items: { orderBy: { id: "asc" } }, payment: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return respond(orderListSchema, { items: orders.map((o) => this.detail(o)) });
  }

  private detail(o: OrderWithItems): OrderDetail {
    return toOrderDetail(o);
  }
}
