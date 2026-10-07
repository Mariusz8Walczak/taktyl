"use client";
// docs/15 §7.1: stany ekranu - ladowanie (szkielet), blad (komunikat + "Spróbuj ponownie"), 403 (brak dostepu), 404.
import { Alert, Button } from "@taktyl/ui";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ApiError } from "../../lib/api/client";
import { Skeleton } from "./skeleton";

export function Forbidden() {
  return (
    <div className="adm-stos">
      <h1 tabIndex={-1}>Brak dostępu</h1>
      <Alert variant="uwaga">Twoja rola nie ma dostępu do tego ekranu.</Alert>
    </div>
  );
}

export function NotFoundState({ what }: { what: string }) {
  return (
    <div className="adm-stos">
      <h1 tabIndex={-1}>Nie znaleziono</h1>
      <Alert variant="info">{what}</Alert>
      <a className="tk-link" href="/">
        Wróć do pulpitu
      </a>
    </div>
  );
}

export function QueryBoundary<T>({
  query,
  errorText,
  notFoundText,
  rows,
  children,
}: {
  query: UseQueryResult<T>;
  /** np. "Nie udało się pobrać produktów." */
  errorText: string;
  notFoundText?: string;
  rows?: number;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <Skeleton rows={rows} label="Wczytywanie danych" />;
  if (query.isError) {
    const err = query.error;
    if (err instanceof ApiError && err.status === 403) return <Forbidden />;
    if (err instanceof ApiError && err.status === 404)
      return <NotFoundState what={notFoundText ?? "Nie ma takiego zasobu."} />;
    return (
      <div className="adm-stos" role="alert">
        <Alert variant="blad">{errorText}</Alert>
        <div>
          <Button
            variant="secondary"
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Spróbuj ponownie
          </Button>
        </div>
      </div>
    );
  }
  return <>{children(query.data)}</>;
}
