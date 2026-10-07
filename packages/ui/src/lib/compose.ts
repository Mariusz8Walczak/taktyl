import type { SyntheticEvent } from "react";

/** Wywoluje kolejne handlery; zatrzymuje sie, gdy ktorys wywola preventDefault. */
export function callAll<E extends SyntheticEvent>(
  ...handlers: Array<((e: E) => void) | undefined>
): (e: E) => void {
  return (e) => {
    for (const h of handlers) {
      h?.(e);
      if (e.defaultPrevented) return;
    }
  };
}

/** Laczy identyfikatory dla aria-describedby, pomijajac puste. */
export function joinIds(...ids: Array<string | false | null | undefined>): string | undefined {
  const out = ids.filter(Boolean).join(" ");
  return out || undefined;
}
