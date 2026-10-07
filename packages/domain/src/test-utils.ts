// Tylko dla testow: wczytanie data/*.json (sciezka wzgledna do roota repo). Nie jest eksportowane z pakietu.
import { readFileSync } from "node:fs";

export function readData<T>(name: string): T {
  const url = new URL(`../../../data/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as T;
}
