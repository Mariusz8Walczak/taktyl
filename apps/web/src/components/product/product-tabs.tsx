"use client";
// F-070...F-073 (wzorce: zakladki `product-detail` i harmonijka `product-description-accordion`, docs/08 §3):
// zakladki na komputerze, harmonijka na telefonie. Jedna struktura DOM: przyciski z aria-expanded/aria-controls
// (wzorzec "disclosure"); na komputerze CSS uklada przyciski w rzad nad panelem (siatka), na telefonie panele
// otwieraja sie pod swoim przyciskiem. Na komputerze zawsze jest otwarty dokladnie jeden panel; na telefonie
// kazdy da sie zwinac. Tresc paneli jest renderowana na serwerze (props `content`).
import { useId, useState, type ReactNode } from "react";

export interface TabSection {
  id: string;
  title: string;
  content: ReactNode;
}

const DESKTOP = "(min-width: 992px)";

export function ProductTabs({ sections }: { sections: readonly TabSection[] }) {
  const uid = useId();
  const [open, setOpen] = useState<string | null>(sections[0]?.id ?? null);

  function toggle(id: string) {
    const desktop = window.matchMedia?.(DESKTOP).matches ?? false;
    setOpen((cur) => (cur === id ? (desktop ? id : null) : id));
  }

  return (
    <div className="zakladki" data-liczba={sections.length}>
      {sections.map((s) => {
        const expanded = open === s.id;
        const btnId = `${uid}-przycisk-${s.id}`;
        const panelId = `${uid}-panel-${s.id}`;
        return (
          <div key={s.id} className="zakladki__sekcja">
            <h2 className="zakladki__naglowek">
              <button
                type="button"
                id={btnId}
                className="zakladki__przycisk"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(s.id)}
              >
                {s.title}
              </button>
            </h2>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              className="zakladki__panel"
              hidden={!expanded}
            >
              {s.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
