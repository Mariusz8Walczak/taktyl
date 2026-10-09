// I-014: sekrety (haslo admina, ciasteczko sesji, token CSRF) nigdy nie trafiaja do odpowiedzi narzedzi ani do logow.
const MIN_SECRET_LENGTH = 6;

export function createRedactor(
  secrets: () => Iterable<string | undefined>,
): (text: string) => string {
  return (text) => {
    let out = text;
    for (const s of secrets()) {
      if (s && s.length >= MIN_SECRET_LENGTH) out = out.split(s).join("[ukryte]");
    }
    return out;
  };
}

/** Log na stderr (stdout to kanal protokolu MCP w stdio). Tylko nazwa zdarzenia i pola techniczne, bez tresci zadan i odpowiedzi. */
export function log(
  event: string,
  fields: Record<string, string | number | boolean | undefined> = {},
): void {
  process.stderr.write(`${JSON.stringify({ ts: new Date().toISOString(), event, ...fields })}\n`);
}
