"use client";
// F-221 (wzorzec: harmonijka szablonu `accordion`, docs/08 §6; wzorzec "disclosure" jak WEB-015): pytania FAQ.
// Kazde pytanie to `button` z aria-expanded i aria-controls, odpowiedz to panel role=region (ukryty atrybutem
// `hidden`). Odpowiedzi renderuje serwer (Markdown) i przekazuje jako dzieci; tu tylko stan otwarcia.
import { useId, useState } from "react";
import type { ReactNode } from "react";
import "../../styles/poradnik.css";

export interface FaqEntry {
  key: string;
  question: string;
  answer: ReactNode;
}

export function FaqAccordion({ items }: { items: readonly FaqEntry[] }) {
  const base = useId();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return (
    <ul className="lista faq">
      {items.map((it, i) => {
        const id = `${base}-${i}`;
        const expanded = open.has(it.key);
        return (
          <li key={it.key} className="faq__pozycja">
            <h2 className="faq__pytanie">
              <button
                type="button"
                id={`${id}-przycisk`}
                className="faq__przycisk"
                aria-expanded={expanded}
                aria-controls={`${id}-panel`}
                onClick={() => toggle(it.key)}
              >
                <span>{it.question}</span>
                <span className="faq__znak" aria-hidden="true">
                  {expanded ? "−" : "+"}
                </span>
              </button>
            </h2>
            <div
              id={`${id}-panel`}
              role="region"
              aria-labelledby={`${id}-przycisk`}
              className="faq__odpowiedz"
              hidden={!expanded}
            >
              {it.answer}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
