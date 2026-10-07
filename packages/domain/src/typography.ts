// docs/01 par. 4: twarda spacja miedzy liczba a jednostka i po jednoliterowych spojnikach/przyimkach.

const NBSP = "\u00A0";

/**
 * Wstawia twarde spacje: po jednoliterowych w, z, i, a, o, u (na poczatku wyrazu)
 * oraz miedzy cyfra a jednostka (zł, g, kg, cm, mm, Hz, GHz, DPI, mAh, h, szt.).
 */
export function applyNbsp(text: string): string {
  return text
    .replace(/(^|[\s(„"])([wziaouWZIAOU]) /gu, `$1$2${NBSP}`)
    .replace(/(\d) (zł|g|kg|cm|mm|Hz|GHz|DPI|mAh|h|szt\.)(?![\p{L}])/gu, `$1${NBSP}$2`);
}
