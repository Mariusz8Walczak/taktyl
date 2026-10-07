"use client";
// A-04 (docs/07 §3.3), wspolne dla kreatora i koszyka.
import { useEffect, useRef, useState } from "react";
import { formatPLN } from "@taktyl/domain";
import { VisuallyHidden } from "@taktyl/ui";
import { cx } from "../../lib/builder/cx";
import { animujKwote } from "../../lib/motion/animuj-kwote";

/**
 * F-107, A-04: kwota z cyframi tabelarycznymi (.kwota). Widoczna wartosc jest animowana przez animujKwote (docs/07 §3.3),
 * czytnik ekranu dostaje tylko wartosc koncowa z ukrytego regionu live. Tekst obu elementow ustawia kod (nie React),
 * zeby render nie nadpisywal klatek animacji; pierwsza wartosc jest renderowana serwerowo i bez ruchu.
 */
export function Kwota({
  gr,
  className,
  testId,
}: {
  gr: number;
  className?: string;
  testId?: string;
}) {
  const [initial] = useState(() => formatPLN(gr));
  const visible = useRef<HTMLSpanElement>(null);
  const prev = useRef(gr);
  useEffect(() => {
    const el = visible.current;
    if (!el || prev.current === gr) return undefined;
    const from = prev.current;
    prev.current = gr;
    return animujKwote(el, from, gr);
  }, [gr]);
  return (
    <span className={cx("kwota", className)} data-kwota="" data-testid={testId}>
      <span ref={visible} className="kwota__wartosc" aria-hidden="true" suppressHydrationWarning>
        {initial}
      </span>
      <VisuallyHidden>
        <span data-kwota-live="" aria-live="polite" suppressHydrationWarning>
          {initial}
        </span>
      </VisuallyHidden>
    </span>
  );
}
