"use client";
// B-500..B-508 (docs/15 par. 11.1): ekran /media - manifest zdjec jako lista zadan dla czlowieka. Backpanel NIE tworzy ani nie
// rysuje obrazow: przyjmuje pliki WebP dostarczone przez czlowieka (kontrola typu, rozmiaru i wymiarow robi API).
// Lista (klucz, produkt, kolor, rodzaj, wymiary i nazwa pliku, priorytet, status tekstem), filtry w adresie, licznik P0 liczony
// z danych, wgrywanie natywnym polem pliku w oknie z pulapka fokusu (drag-and-drop nie jest jedyna droga), miniatura po
// wgraniu z alt="" (opis niesie wiersz tabeli), usuniecie pliku (owner) w oknie dialogowym.
// Znaczniki po zapisie: product:{slug}, category:{k}, presets (API, outbox).
import type { MediaEntry, MediaUploadResponse } from "@taktyl/contracts";
import { Alert, Button, Dialog, Field, FilterChip } from "@taktyl/ui";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useRef, useState } from "react";
import { ApiError } from "../../lib/api/client";
import { mediaApi } from "../../lib/api/endpoints";
import { describeError } from "../../lib/api/messages";
import { useAuth } from "../../lib/auth/session";
import { can, denyReason } from "../../lib/can";
import { formatCount } from "../../lib/format";
import {
  MEDIA_COUNT,
  MEDIA_KIND_LABEL,
  MEDIA_STATUS_LABEL,
  shopUrlForEntry,
  slotSize,
} from "../../lib/media-labels";
import { useMedia, useProducts, type MediaListParams } from "../../lib/queries";
import { useUrlState } from "../../lib/use-url-state";
import { DataTable } from "../ui/data-table";
import { DisabledReason } from "../ui/disabled-reason";
import { PageHeader } from "../ui/page-header";
import { Pagination } from "../ui/pagination";
import { QueryBoundary } from "../ui/query-state";

const PER_PAGE = 50;
const KINDS = ["packshot", "topdown", "texture"] as const;

/** Komunikaty bledow wgrywania (B-502..B-504): tresc z API (wymiary, typ, rozmiar), a gdy jej brak, tekst wg kodu. */
export function uploadErrors(err: unknown): string[] {
  if (err instanceof ApiError) {
    const fromApi = err.fieldErrors.map((e) => e.message).filter(Boolean);
    if (fromApi.length > 0) return fromApi;
    if (err.status === 415) return ["Wgraj plik WebP."];
    if (err.status === 413) return ["Plik jest za duży. Wgraj mniejszy plik WebP."];
  }
  return [describeError(err, "ten wpis").text];
}

function UploadDialog({
  entry,
  onClose,
  returnFocus,
}: {
  entry: MediaEntry;
  onClose: () => void;
  returnFocus: HTMLElement | null;
}) {
  const qc = useQueryClient();
  const [files, setFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MediaUploadResponse | null>(null);
  const errRef = useRef<HTMLDivElement>(null);

  const pick = (slot: string, file: File | undefined) => {
    setFiles((f) => {
      const next = { ...f };
      if (file) next[slot] = file;
      else delete next[slot];
      return next;
    });
    setPreviews((p) => {
      const next = { ...p };
      if (p[slot]) URL.revokeObjectURL(p[slot]);
      if (file) next[slot] = URL.createObjectURL(file);
      else delete next[slot];
      return next;
    });
  };

  const submit = async () => {
    setErrors([]);
    if (Object.keys(files).length === 0) {
      setErrors(["Wybierz co najmniej jeden plik WebP."]);
      errRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await mediaApi.upload(entry.key, files);
      setResult(res);
      void qc.invalidateQueries({ queryKey: ["media"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      setErrors(uploadErrors(e));
      setTimeout(() => errRef.current?.focus(), 0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Wgraj pliki: ${entry.key}`}
      returnFocusRef={{ current: returnFocus }}
      footer={
        result ? (
          <Button onClick={onClose}>Zamknij</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Anuluj
            </Button>
            <Button loading={busy} onClick={() => void submit()}>
              Wgraj
            </Button>
          </>
        )
      }
    >
      <div className="adm-stos">
        <p className="adm-powod">
          Wgraj gotowy plik WebP przygotowany przez człowieka. Nazwa pliku w sklepie jest zawsze
          taka, jak w manifeście, bez względu na nazwę wybranego pliku.
        </p>
        {errors.length > 0 ? (
          <div ref={errRef} tabIndex={-1}>
            <Alert variant="blad" title="Nie wgrano plików">
              <ul className="adm-lista">
                {errors.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </Alert>
          </div>
        ) : null}
        {result ? (
          <div className="adm-stos" role="status">
            <Alert variant="sukces">
              Wgrano: {result.uploaded.join(", ")}.{" "}
              {result.missing.length > 0
                ? `Brakuje jeszcze: ${result.missing.join(", ")}. Wpis zmieni status na gotowe po wgraniu wszystkich.`
                : "Wpis ma status gotowe."}{" "}
              Zmiana pojawi się w sklepie w ciągu kilku sekund.
            </Alert>
            {result.warnings.map((w) => (
              <Alert key={`${w.code}-${w.slot}`} variant="uwaga">
                {w.message}
              </Alert>
            ))}
            <a
              className="tk-link"
              href={shopUrlForEntry(result.entry)}
              target="_blank"
              rel="noreferrer"
            >
              Podgląd w sklepie
            </a>
            <ul className="adm-lista">
              {result.entry.slots
                .filter((s) => s.present && s.url)
                .map((s) => (
                  <li key={s.slot}>
                    {/* miniatura pliku dostarczonego przez czlowieka; alt="" bo opis niesie wiersz tabeli (B-508) */}
                    <img src={s.url ?? ""} alt="" className="adm-miniatura" loading="lazy" />{" "}
                    <span>
                      {s.slot}: {s.file_name}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ) : (
          entry.slots.map((s) => (
            <div key={s.slot} className="adm-stos">
              <Field
                type="file"
                accept="image/webp"
                label={`Plik ${s.slot}: ${slotSize(s)}`}
                hint={`Nazwa w sklepie: ${s.file_name}. Tylko WebP.`}
                onChange={(e) => pick(s.slot, e.target.files?.[0])}
              />
              {previews[s.slot] ? (
                <p>
                  {/* podglad wybranego pliku przed wyslaniem; alt="" (B-508) */}
                  <img src={previews[s.slot]} alt="" className="adm-miniatura" />{" "}
                  {files[s.slot]?.name}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </Dialog>
  );
}

function RemoveDialog({
  entry,
  onClose,
  returnFocus,
}: {
  entry: MediaEntry;
  onClose: () => void;
  returnFocus: HTMLElement | null;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await mediaApi.remove(entry.key);
      await qc.invalidateQueries({ queryKey: ["media"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    } catch (e) {
      setError(describeError(e, "ten wpis").text);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Usunąć pliki z wpisu?"
      returnFocusRef={{ current: returnFocus }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button loading={busy} onClick={() => void run()}>
            Usuń pliki
          </Button>
        </>
      }
    >
      <div className="adm-stos">
        <p>
          Pliki wpisu {entry.key} zostaną usunięte z wolumenu, a status wróci na brak. Sklep pokaże
          placeholder.
        </p>
        {error ? <Alert variant="blad">{error}</Alert> : null}
      </div>
    </Dialog>
  );
}

export function MediaView() {
  const url = useUrlState();
  const { session } = useAuth();
  const role = session?.user.role;
  const canUpload = can(role, "media.write");
  const canRemove = can(role, "catalog.delete");
  const uploadReason = denyReason(role, "media.write");
  const products = useProducts({ page: 1, per_page: 100, sort: "name" });

  const status = url.get("status");
  const kind = url.get("kind");
  const priority = url.get("priority");
  const params: MediaListParams = {
    page: Number(url.get("page")) || 1,
    per_page: PER_PAGE,
    ...(status === "gotowe" || status === "brak" ? { status } : {}),
    ...(kind === "packshot" || kind === "topdown" || kind === "texture" ? { kind } : {}),
    ...(priority === "P0" || priority === "P1" ? { priority } : {}),
    ...(url.get("product_id") ? { product_id: url.get("product_id") } : {}),
  };
  const query = useMedia(params);

  const [uploadFor, setUploadFor] = useState<MediaEntry | null>(null);
  const [removeFor, setRemoveFor] = useState<MediaEntry | null>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const focusOf = (e: MediaEntry | null) => (e ? (triggers.current.get(e.key) ?? null) : null);

  const columns = useMemo<ColumnDef<MediaEntry, unknown>[]>(
    () =>
      [
        {
          id: "key",
          header: "Klucz",
          meta: { sticky: true },
          cell: ({ row }: { row: { original: MediaEntry } }) => row.original.key,
        },
        {
          id: "product",
          header: "Produkt",
          cell: ({ row }: { row: { original: MediaEntry } }) =>
            row.original.product_name ?? row.original.product_id,
        },
        {
          id: "color",
          header: "Kolor",
          cell: ({ row }: { row: { original: MediaEntry } }) => row.original.color,
        },
        {
          id: "kind",
          header: "Rodzaj",
          cell: ({ row }: { row: { original: MediaEntry } }) => (
            <>
              {MEDIA_KIND_LABEL[row.original.kind]}
              {row.original.shot ? ` (${row.original.shot})` : ""}
            </>
          ),
        },
        {
          id: "dims",
          header: "Wymagane wymiary i pliki",
          cell: ({ row }: { row: { original: MediaEntry } }) => (
            <ul className="adm-lista adm-tekst-xs">
              {row.original.slots.map((s) => (
                <li key={s.slot}>
                  {s.slot}: {slotSize(s)}, {s.file_name}
                  {s.present ? " (jest)" : " (brak)"}
                </li>
              ))}
            </ul>
          ),
        },
        {
          id: "priority",
          header: "Priorytet",
          cell: ({ row }: { row: { original: MediaEntry } }) => row.original.priority,
        },
        {
          id: "status",
          header: "Status",
          cell: ({ row }: { row: { original: MediaEntry } }) =>
            MEDIA_STATUS_LABEL[row.original.status],
        },
        {
          id: "actions",
          header: "Akcje",
          cell: ({ row }: { row: { original: MediaEntry } }) => {
            const e = row.original;
            return (
              <span className="adm-zetony">
                <Button
                  variant="secondary"
                  disabled={!canUpload}
                  aria-describedby={!canUpload ? "powod-media" : undefined}
                  aria-label={`Wgraj plik: ${e.key}`}
                  ref={(el: HTMLButtonElement | null) => {
                    if (el) triggers.current.set(e.key, el);
                    else triggers.current.delete(e.key);
                  }}
                  onClick={() => setUploadFor(e)}
                >
                  Wgraj plik
                </Button>
                {e.status === "gotowe" ? (
                  <Button
                    variant="secondary"
                    disabled={!canRemove}
                    title={canRemove ? undefined : "Tylko właściciel usuwa pliki."}
                    aria-label={`Usuń pliki: ${e.key}`}
                    onClick={() => setRemoveFor(e)}
                  >
                    Usuń pliki
                  </Button>
                ) : null}
              </span>
            );
          },
        },
      ] as unknown as ColumnDef<MediaEntry, unknown>[],
    [canUpload, canRemove],
  );

  const chip = (key: string, value: string, label: string, current: string) => (
    <FilterChip
      key={`${key}-${value}`}
      active={current === value}
      onClick={() => url.set({ [key]: current === value ? undefined : value })}
    >
      {label}
    </FilterChip>
  );

  return (
    <div className="adm-strona">
      <QueryBoundary query={query} errorText="Nie udało się pobrać manifestu zdjęć.">
        {(data) => (
          <>
            <PageHeader
              title="Zdjęcia"
              count={`Gotowe ${data.progress.p0_ready} z ${data.progress.p0_total} (P0). ${formatCount(data.total, MEDIA_COUNT)} po filtrach.`}
            />
            <p className="adm-powod">
              Panel nie tworzy zdjęć. Wgrywasz gotowe pliki WebP według manifestu (docs/09). Do
              czasu wgrania sklep pokazuje placeholdery.
            </p>
            <DisabledReason id="powod-media" reason={uploadReason} />
            <div className="adm-narzedzia" role="search" aria-label="Filtry manifestu zdjęć">
              <Field
                as="select"
                label="Produkt"
                value={url.get("product_id")}
                onChange={(e) => url.set({ product_id: e.target.value })}
              >
                <option value="">Wszystkie produkty</option>
                {(products.data?.items ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Field>
            </div>
            <div className="adm-zetony" role="group" aria-label="Status zdjęcia">
              {chip("status", "gotowe", "Gotowe", status)}
              {chip("status", "brak", "Brak", status)}
            </div>
            <div className="adm-zetony" role="group" aria-label="Rodzaj zdjęcia">
              {KINDS.map((k) => chip("kind", k, MEDIA_KIND_LABEL[k], kind))}
            </div>
            <div className="adm-zetony" role="group" aria-label="Priorytet">
              {chip("priority", "P0", "P0", priority)}
              {chip("priority", "P1", "P1", priority)}
            </div>
            {data.items.length === 0 ? (
              <div className="adm-stos">
                {url.hasAny ? (
                  <>
                    <p>Nic tu nie pasuje do filtrów.</p>
                    <div>
                      <Button variant="secondary" onClick={() => url.clear()}>
                        Wyczyść filtry
                      </Button>
                    </div>
                  </>
                ) : (
                  <p>Manifest jest pusty. Uruchom seed.</p>
                )}
              </div>
            ) : (
              <DataTable
                caption="Manifest zdjęć"
                columns={columns}
                data={data.items}
                getRowId={(r) => r.key}
              />
            )}
            <Pagination
              page={data.page}
              perPage={data.per_page}
              total={data.total}
              onPage={(p) => url.set({ page: String(p) }, true)}
            />
          </>
        )}
      </QueryBoundary>
      {uploadFor ? (
        <UploadDialog
          key={uploadFor.key}
          entry={uploadFor}
          returnFocus={focusOf(uploadFor)}
          onClose={() => setUploadFor(null)}
        />
      ) : null}
      {removeFor ? (
        <RemoveDialog
          key={removeFor.key}
          entry={removeFor}
          returnFocus={focusOf(removeFor)}
          onClose={() => setRemoveFor(null)}
        />
      ) : null}
    </div>
  );
}
