// B-502..B-504 (docs/09 par. 3-4): oczekiwane miejsca na pliki i wymiary wpisu manifestu oraz komunikaty bledow wymiarow.
// Nazwa pliku i jego sciezka pochodza WYLACZNIE z manifestu (kolumna `files`), nigdy z uploadu.
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { MediaSlot } from "@taktyl/contracts";

export interface SlotSpec {
  slot: MediaSlot;
  /** sciezka wzgledem MEDIA_DIR, np. img/top/k-kwarc-60_grafit_top@1x.webp */
  path: string;
  fileName: string;
  width: number;
  height: number;
}

export interface ImageRowLike {
  kind: string;
  files: readonly string[];
  pixels: unknown;
}

/** Dozwolona sciezka pliku z manifestu: male segmenty, rozszerzenie .webp, bez `..` i bez ukosnika wiodacego. */
const SAFE_PATH = /^(?:[a-z0-9_-]+\/)+[a-z0-9_@-]+(?:[.-][a-z0-9_@-]+)*\.webp$/;
const PACKSHOT_SLOT = /-(400|800|1600)\.webp$/;
const DENSITY_SLOT = /@(1x|2x)\.webp$/;

export const isSafeMediaPath = (p: string): boolean => SAFE_PATH.test(p) && !p.includes("..");

/** Zamienia sciezke wzgledna na bezwzgledna w MEDIA_DIR; `null`, gdy wychodzi poza katalog (path traversal). */
export function resolveInMediaDir(mediaDir: string, relPath: string): string | null {
  if (!isSafeMediaPath(relPath)) return null;
  const root = resolve(mediaDir);
  const abs = resolve(root, relPath);
  const rel = relative(root, abs);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel) || !abs.startsWith(root + sep))
    return null;
  return abs;
}

const asPair = (v: unknown): [number, number] | null =>
  Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && n > 0)
    ? [v[0] as number, v[1] as number]
    : null;

/** Miejsca na pliki wpisu: packshot 400/800/1600 (kwadrat), topdown i texture `@1x`/`@2x` wg `pixels`. */
export function slotSpecs(row: ImageRowLike): SlotSpec[] {
  const out: SlotSpec[] = [];
  const pixels = (row.pixels ?? {}) as Record<string, unknown>;
  for (const path of row.files) {
    if (!isSafeMediaPath(path)) continue;
    const fileName = path.slice(path.lastIndexOf("/") + 1);
    if (row.kind === "packshot") {
      const m = PACKSHOT_SLOT.exec(path);
      if (m)
        out.push({
          slot: m[1] as MediaSlot,
          path,
          fileName,
          width: Number(m[1]),
          height: Number(m[1]),
        });
    } else {
      const m = DENSITY_SLOT.exec(path);
      const px = m ? asPair(pixels[m[1] as string]) : null;
      if (m && px)
        out.push({ slot: m[1] as MediaSlot, path, fileName, width: px[0], height: px[1] });
    }
  }
  return out;
}

const TIMES = "×";

/** B-503, B-504: "Plik ma 330 x 140 px. Ten wpis wymaga 327 x 140 px (1 px = 1 mm)." */
export function dimensionsMessage(
  kind: string,
  slot: MediaSlot,
  actual: { width: number; height: number },
  expected: { width: number; height: number },
): string {
  const base = `Plik ma ${actual.width} ${TIMES} ${actual.height} px. Ten wpis wymaga ${expected.width} ${TIMES} ${expected.height} px`;
  if (kind === "topdown") return `${base} (${slot === "2x" ? "2 px = 1 mm" : "1 px = 1 mm"}).`;
  return `${base}.`;
}

export const NO_ALPHA_MESSAGE = "Plik nie ma przezroczystego tła.";
export const NOT_WEBP_MESSAGE = "Wgraj plik WebP.";
