// F-111 (docs/16 par. 2, docs/05 par. 2): gotowe sety z cena policzona na biezaco (suma, rabat, razem) przez domene.
import { Inject, Injectable } from "@nestjs/common";
import { presetsResponseSchema } from "@taktyl/contracts";
import { priceSet } from "@taktyl/domain";
import { respond } from "../common/zod.pipe.js";
import { PrismaService } from "../prisma/prisma.service.js";

const CATEGORY_ORDER = ["klawiatury", "myszki", "podkladki"];

@Injectable()
export class PresetsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list() {
    const [shop, presets] = await Promise.all([
      this.prisma.shopSettings.findFirstOrThrow(),
      this.prisma.preset.findMany({
        orderBy: { position: "asc" },
        include: { items: { include: { variant: { include: { product: true } } } } },
      }),
    ]);
    return respond(presetsResponseSchema, {
      items: presets.map((p) => {
        const items = [...p.items].sort(
          (a, b) => CATEGORY_ORDER.indexOf(a.categoryId) - CATEGORY_ORDER.indexOf(b.categoryId),
        );
        const price = priceSet(
          items.map((i) => ({ sku: i.sku, category: i.categoryId, price: i.variant.priceGr })),
          { percent: shop.setDiscountPercent, requiresCategories: shop.setDiscountCategories },
        );
        return {
          id: p.id,
          name: p.name,
          profile: p.profile,
          note: p.note,
          items: items.map((i) => ({
            sku: i.sku,
            name: i.variant.product.name,
            price_gr: i.variant.priceGr,
          })),
          sum_gr: price.sum,
          set_discount_gr: price.discount,
          total_gr: price.total,
        };
      }),
    });
  }
}
