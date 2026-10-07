import type { ReactNode } from "react";

/** Naglowek strony: H1 + licznik / akcje (docs/15 §7.1). H1 ma tabIndex -1 (fokus po nawigacji i zapisie). */
export function PageHeader({
  title,
  count,
  children,
}: {
  title: ReactNode;
  count?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="adm-strona__naglowek">
      <h1 tabIndex={-1}>{title}</h1>
      {count ? (
        <p className="adm-licznik" aria-live="polite">
          {count}
        </p>
      ) : null}
      {children}
    </div>
  );
}
