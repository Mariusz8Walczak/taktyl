"use client";
// B-100, B-200: paginacja serwerowa (docs/16 §1: page, per_page, total).
import { Button } from "@taktyl/ui";

export function Pagination({
  page,
  perPage,
  total,
  onPage,
}: {
  page: number;
  perPage: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  return (
    <nav className="adm-stronicowanie" aria-label="Stronicowanie">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Poprzednia strona
      </Button>
      <p className="adm-licznik" aria-live="polite">
        Strona {page} z {pages}
      </p>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Następna strona
      </Button>
    </nav>
  );
}
