// I-009: wspolne wyszukiwanie katalogu z data/products.json (CLI seeda i DemoService w API).
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Idzie w gore od pliku wywolujacego (import.meta.url), az znajdzie katalog z data/products.json; SEED_ROOT ma pierwszenstwo. */
export function findSeedRoot(fromUrl: string): string {
  if (process.env.SEED_ROOT) return process.env.SEED_ROOT;
  let dir = dirname(fileURLToPath(fromUrl));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "data", "products.json"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("Nie znaleziono katalogu z data/products.json (ustaw SEED_ROOT)");
}
