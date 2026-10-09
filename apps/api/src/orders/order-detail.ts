// F-178, F-202, B-202: wspolne mapowanie zamowienia z bazy na kontrakt `orderDetailSchema` (sklep i backpanel).
import type { Prisma } from "../prisma/client.js";
import { orderDetailSchema, type OrderDetail } from "@taktyl/contracts";
import { respond } from "../common/zod.pipe.js";

export type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true; payment: true } }>;

const date = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

export function toOrderDetail(o: OrderWithItems): OrderDetail {
  return respond(orderDetailSchema, {
    number: o.number,
    status: o.status,
    currency: "PLN",
    created_at: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      group_id: i.groupId,
      sku: i.sku,
      name: i.name,
      variant_label: i.variantLabel,
      config_sku: i.configSku,
      qty: i.qty,
      unit_price_gr: i.unitPriceGr,
      set_discount_gr: i.setDiscountGr,
      coupon_discount_gr: i.couponDiscountGr,
    })),
    items_gr: o.itemsGr,
    set_discount_gr: o.setDiscountGr,
    coupon_discount_gr: o.couponDiscountGr,
    shipping_gr: o.shippingGr,
    total_gr: o.totalGr,
    coupon_code: o.couponCode,
    shipping_method: o.shippingMethodId,
    payment: {
      type: o.paymentType,
      status: o.payment?.status ?? "created",
      attempts: o.payment?.attempts ?? 0,
    },
    eta:
      o.dispatchDate && o.deliveryDate
        ? { dispatch_date: date(o.dispatchDate), delivery_date: date(o.deliveryDate) }
        : null,
  });
}
