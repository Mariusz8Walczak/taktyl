// TAKTYL-63/64 (B-500..B-508, B-600..B-607): kontrakty mediow i pulpitu.
import { describe, expect, it } from "vitest";
import { dashboardSchema, mediaListSchema, mediaUploadResponseSchema } from "../src";

describe("media i pulpit (TAKTYL-63, TAKTYL-64)", () => {
  const progress = { p0_ready: 0, p0_total: 76, total_ready: 0, total: 190 };
  const entry = {
    key: "k-kwarc-60_grafit_top",
    product_id: "k-kwarc-60",
    product_slug: "kwarc-60",
    product_name: "Kwarc 60",
    color: "grafit",
    kind: "topdown",
    shot: null,
    description: "wycinek z gory",
    priority: "P0",
    status: "brak",
    dims_mm: { w: 293, d: 102 },
    pixels: { "1x": [293, 102], "2x": [586, 204] },
    slots: [
      {
        slot: "1x",
        file_name: "k-kwarc-60_grafit_top@1x.webp",
        path: "img/top/k-kwarc-60_grafit_top@1x.webp",
        width: 293,
        height: 102,
        present: false,
        url: null,
      },
    ],
    updated_at: "2026-10-07T10:00:00+02:00",
  };

  it("lista mediow niesie postep P0 liczony z danych", () => {
    const page = { items: [entry], page: 1, per_page: 50, total: 1 };
    expect(mediaListSchema.safeParse({ ...page, progress }).success).toBe(true);
    expect(mediaListSchema.safeParse(page).success).toBe(false);
    expect(
      mediaListSchema.safeParse({ ...page, items: [{ ...entry, kind: "video" }], progress })
        .success,
    ).toBe(false);
  });

  it("odpowiedz uploadu: ostrzezenie o braku alfy nie jest bledem", () => {
    const body = {
      entry,
      uploaded: ["1x"],
      missing: ["2x"],
      warnings: [{ code: "no_alpha", slot: "1x", message: "Plik nie ma przezroczystego tla." }],
      progress,
    };
    expect(mediaUploadResponseSchema.safeParse(body).success).toBe(true);
    expect(mediaUploadResponseSchema.safeParse({ ...body, uploaded: ["3x"] }).success).toBe(false);
  });

  it("pulpit: tylko liczby i listy, status zamowienia ze slownika", () => {
    const body = {
      generated_at: "2026-10-07T10:00:00+02:00",
      orders: {
        today: 1,
        last_7_days: 2,
        last_30_days: 3,
        total: 4,
        by_status: { paid: 2, cancelled: 1 },
      },
      revenue: { paid_7_days_gr: 74900, paid_30_days_gr: 74900 },
      low_stock: {
        count: 1,
        out_of_stock_count: 1,
        items: [
          {
            sku: "P-LOD-L-MGL",
            product_id: "p-lod",
            product_slug: "lod",
            product_name: "Lod",
            stock: 0,
          },
        ],
      },
      orders_to_handle: [],
      images_p0: { ready: 0, total: 76 },
      recent_changes: [],
      connection: { outbox_pending: 0, outbox_failed: 0, last_revalidated_at: null },
    };
    expect(dashboardSchema.safeParse(body).success).toBe(true);
    expect(
      dashboardSchema.safeParse({ ...body, orders: { ...body.orders, by_status: { nieznany: 1 } } })
        .success,
    ).toBe(false);
  });
});
