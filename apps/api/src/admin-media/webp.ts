// B-502..B-505 (docs/09 par. 4, docs/15 par. 11): odczyt naglowka WebP (wymiary i kanal alfa) bez zewnetrznych bibliotek.
// Sprawdzamy tylko strukture RIFF i naglowek pierwszego kawalka (VP8, VP8L, VP8X); obrazu nie dekodujemy ani nie analizujemy
// (B-504: "tylko wymiary, bez analizy obrazu"). Decyzja API-016 w docs/decyzje.md.

export interface WebpInfo {
  width: number;
  height: number;
  /** plik niesie kanal alfa (VP8L z alfa albo VP8X z flaga alfa) */
  hasAlpha: boolean;
}

const ascii = (b: Uint8Array, at: number, len: number): string =>
  String.fromCharCode(...b.subarray(at, at + len));

/** Zwraca wymiary i informacje o alfie albo `null`, gdy to nie jest poprawny plik WebP. */
export function readWebpInfo(buf: Uint8Array): WebpInfo | null {
  if (buf.length < 26) return null;
  if (ascii(buf, 0, 4) !== "RIFF" || ascii(buf, 8, 4) !== "WEBP") return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const riffEnd = view.getUint32(4, true) + 8;
  // Rozmiar RIFF musi zgadzac sie z dlugoscia pliku (z dopuszczeniem jednego bajtu dopelnienia).
  if (riffEnd > buf.length || buf.length - riffEnd > 1) return null;
  const fourcc = ascii(buf, 12, 4);
  const size = view.getUint32(16, true);
  if (20 + size > riffEnd) return null;
  if (fourcc === "VP8X") {
    if (size < 10 || buf.length < 30) return null;
    const flags = buf[20] as number;
    const width =
      1 + ((buf[24] as number) | ((buf[25] as number) << 8) | ((buf[26] as number) << 16));
    const height =
      1 + ((buf[27] as number) | ((buf[28] as number) << 8) | ((buf[29] as number) << 16));
    return { width, height, hasAlpha: (flags & 0x10) !== 0 };
  }
  if (fourcc === "VP8L") {
    if (size < 5 || buf[20] !== 0x2f) return null;
    const bits = view.getUint32(21, true);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
      hasAlpha: ((bits >>> 28) & 1) === 1,
    };
  }
  if (fourcc === "VP8 ") {
    if (size < 10 || buf.length < 30 || buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a)
      return null;
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
      hasAlpha: false,
    };
  }
  return null;
}
