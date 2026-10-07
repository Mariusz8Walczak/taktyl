// B-502..B-505 (TAKTYL-63): dane testowe, nie grafika sklepu. Minimalny plik WebP skladany w locie w pamieci:
// poprawny naglowek RIFF + VP8L (wymiary i flaga alfa), bez zadnych danych obrazu. Walidator czyta tylko naglowek,
// wiec to wystarcza do testow wymiarow, alfy, typu i rozmiaru; w repozytorium nie ma plikow graficznych.

export interface FakeWebpOptions {
  /** ustawia flage alfa w naglowku VP8L (domyslnie true) */
  alpha?: boolean;
  /** dodatkowe bajty (kawalek JUNK) - do testu limitu rozmiaru */
  padBytes?: number;
}

export function fakeWebp(width: number, height: number, opts: FakeWebpOptions = {}): Buffer {
  const alpha = opts.alpha ?? true;
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14) | ((alpha ? 1 : 0) << 28);
  const vp8l = Buffer.alloc(8 + 6); // naglowek kawalka + 5 bajtow + 1 dopelnienia
  vp8l.write("VP8L", 0, "ascii");
  vp8l.writeUInt32LE(5, 4);
  vp8l[8] = 0x2f;
  vp8l.writeUInt32LE(bits >>> 0, 9);
  const pad = opts.padBytes && opts.padBytes > 0 ? opts.padBytes + (opts.padBytes % 2) : 0;
  const junk = pad > 0 ? Buffer.alloc(8 + pad) : Buffer.alloc(0);
  if (pad > 0) {
    junk.write("JUNK", 0, "ascii");
    junk.writeUInt32LE(pad, 4);
  }
  const body = Buffer.concat([Buffer.from("WEBP", "ascii"), vp8l, junk]);
  const head = Buffer.alloc(8);
  head.write("RIFF", 0, "ascii");
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}
