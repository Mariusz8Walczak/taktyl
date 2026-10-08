// F-178, F-202 (docs/16 par. 1.1, par. 4 pkt 6, ADR-0007): dostep do zamowienia wylacznie z poprawnym X-Order-Token.
// Numer sam w sobie nie daje dostepu; zly token = 404 (nie ujawniamy istnienia numeru), brak tokenu = 401.
import { Inject, Injectable } from "@nestjs/common";
import type { Order } from "../prisma/client.js";
import { orderTokenHeaderSchema } from "@taktyl/contracts";
import { notFound, unauthorized, validationFailed } from "../common/app-exception.js";
import { CLOCK, type Clock } from "../common/clock.js";
import { hashOrderToken, orderTokenExpired, tokenMatchesHash } from "../common/order-token.js";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";

/** Pojedynczy token z naglowka (po przecinku mozna podac kilka: lista zamowien). */
export function parseTokens(header: string | undefined, max = 20): string[] {
  if (header === undefined || header.trim() === "")
    throw unauthorized("Brak naglowka X-Order-Token.");
  const parsed = orderTokenHeaderSchema.safeParse(header);
  if (!parsed.success) {
    throw validationFailed(
      [{ path: "X-Order-Token", code: "invalid_token", message: "Niepoprawny token." }],
      400,
    );
  }
  const tokens = parsed.data
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length >= 16);
  if (tokens.length === 0) throw unauthorized("Brak poprawnego tokenu zamowienia.");
  return tokens.slice(0, max);
}

@Injectable()
export class OrderAccessService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Najstarsze zamowienie, ktorego token jeszcze dziala (TAKTYL-70, wygasanie tokenu). */
  tokenCutoff(): Date {
    return new Date(this.clock().getTime() - this.config.ORDER_RETENTION_DAYS * 86_400_000);
  }

  /** Zamowienie o danym numerze, jesli token pasuje do jednego z podanych; inaczej 401/404. */
  async authorize(number: string, header: string | undefined): Promise<Order> {
    const tokens = parseTokens(header, 1);
    const order = await this.prisma.order.findUnique({ where: { number } });
    const token = tokens[0] as string;
    if (
      !order ||
      !tokenMatchesHash(token, order.orderTokenHash) ||
      orderTokenExpired(order.createdAt, this.clock(), this.config.ORDER_RETENTION_DAYS)
    )
      throw notFound("Nie znaleziono zamowienia.");
    return order;
  }

  /** Skroty tokenow do wyszukania listy zamowien. */
  hashes(header: string | undefined): string[] {
    return parseTokens(header).map(hashOrderToken);
  }
}
