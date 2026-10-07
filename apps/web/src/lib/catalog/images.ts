// F-060, F-040 (docs/09 §3-5): zdjecia produktu z API (manifest) jako wpisy dla ProductImage. Zdjecia tylko z manifestu;
// brak (`status: "brak"`) = placeholder renderowany przez komponent obrazu.
import type { Product } from "@taktyl/contracts";
import type { ManifestEntry } from "@taktyl/ui";

export type ImageRef = Product["images"][number];

export function toManifestEntry(ref: ImageRef): ManifestEntry {
  return {
    key: ref.key,
    kind: ref.kind,
    ...(ref.shot === null ? {} : { shot: ref.shot }),
    ...(ref.description === null ? {} : { description: ref.description }),
    files: ref.files,
    status: ref.status,
  };
}

/** Ujecia produktowe wariantu (klucz `{id}_{kolor}_{ujecie}`), ujecie 01-34 pierwsze. */
export function packshotsFor(
  images: readonly ImageRef[],
  productId: string,
  imagesKey: string,
): ImageRef[] {
  const prefix = `${productId}_${imagesKey}_`;
  return images
    .filter((i) => i.kind === "packshot" && i.key.startsWith(prefix))
    .sort((a, b) => (a.shot ?? a.key).localeCompare(b.shot ?? b.key));
}

/** A-09: drugie ujecie karty tylko gdy manifest ma gotowe zdjecie (inaczej pomijane, bez placeholdera). */
export function secondShotFor(
  images: readonly ImageRef[],
  productId: string,
  imagesKey: string,
): ImageRef | null {
  const [, ...rest] = packshotsFor(images, productId, imagesKey);
  return rest.find((i) => i.status === "gotowe") ?? null;
}

/** Prefiks adresow plikow z manifestu: wolumen media za proxy (Caddy: /media/*). */
export const MEDIA_BASE_URL = "/media/";
