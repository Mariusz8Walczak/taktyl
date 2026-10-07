"use client";
// B-308, B-309 (docs/15 par. 9): zgloszenia z formularza kontaktu i zapisy do newslettera - data, typ, e-mail, temat, wiadomosc,
// status "nowe / obsluzone". Filtr rodzaju w adresie (zetony), paginacja serwerowa. Viewer widzi dane zamaskowane juz z API
// (e-mail, tresc ukryta). Oznaczanie jako obsluzone: editor i owner (PATCH, bez znacznikow). Usuwanie (RODO w demo): tylko
// owner, w oknie z pulapka fokusu. W demo nic nie jest wysylane.
import type { AdminMessage } from "@taktyl/contracts";
import { Alert, Button, Dialog, FilterChip } from "@taktyl/ui";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useRef, useState } from "react";
import { messagesApi } from "../../lib/api/endpoints";
import { describeError } from "../../lib/api/messages";
import { useAuth } from "../../lib/auth/session";
import { can, denyReason } from "../../lib/can";
import { MESSAGE_COUNT } from "../../lib/content-labels";
import { formatCount, formatDateTime } from "../../lib/format";
import { useMessages, type MessageListParams } from "../../lib/queries";
import { useUrlState } from "../../lib/use-url-state";
import { DataTable } from "../ui/data-table";
import { PageHeader } from "../ui/page-header";
import { Pagination } from "../ui/pagination";
import { QueryBoundary } from "../ui/query-state";

const PER_PAGE = 25;
const KIND_LABEL = { contact: "Kontakt", newsletter: "Newsletter" } as const;

function statusText(m: AdminMessage): string {
  if (m.handled === null) return "Bez statusu";
  return m.handled ? "Obsłużone" : "Nowe";
}

export function MessagesView() {
  const url = useUrlState();
  const qc = useQueryClient();
  const { session } = useAuth();
  const role = session?.user.role;
  const canHandle = can(role, "content.write");
  const canDelete = can(role, "catalog.delete");
  const kindRaw = url.get("kind");
  const kind = kindRaw === "contact" || kindRaw === "newsletter" ? kindRaw : undefined;
  const params: MessageListParams = {
    page: Number(url.get("page")) || 1,
    per_page: PER_PAGE,
    ...(kind ? { kind } : {}),
  };
  const query = useMessages(params);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminMessage | null>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());

  const refresh = () => qc.invalidateQueries({ queryKey: ["messages"] });

  const toggle = async (m: AdminMessage) => {
    setError(null);
    setBusy(m.id);
    try {
      await messagesApi.setHandled(m.id, !m.handled);
      await refresh();
      setStatus(
        m.handled ? "Zgłoszenie oznaczone jako nowe." : "Zgłoszenie oznaczone jako obsłużone.",
      );
    } catch (e) {
      setError(describeError(e, "to zgłoszenie").text);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setError(null);
    setBusy(toDelete.id);
    try {
      await messagesApi.remove(toDelete.id);
      await refresh();
      setStatus("Zgłoszenie usunięte.");
      setToDelete(null);
    } catch (e) {
      setError(describeError(e, "to zgłoszenie").text);
      setToDelete(null);
    } finally {
      setBusy(null);
    }
  };

  const columns = useMemo<ColumnDef<AdminMessage, unknown>[]>(
    () =>
      [
        {
          id: "created",
          header: "Data",
          meta: { sticky: true },
          cell: ({ row }: { row: { original: AdminMessage } }) =>
            formatDateTime(row.original.created_at),
        },
        {
          id: "kind",
          header: "Typ",
          cell: ({ row }: { row: { original: AdminMessage } }) => KIND_LABEL[row.original.kind],
        },
        {
          id: "email",
          header: "E-mail",
          cell: ({ row }: { row: { original: AdminMessage } }) => row.original.email,
        },
        {
          id: "subject",
          header: "Temat",
          cell: ({ row }: { row: { original: AdminMessage } }) => row.original.subject ?? "",
        },
        {
          id: "body",
          header: "Wiadomość",
          cell: ({ row }: { row: { original: AdminMessage } }) => row.original.body ?? "",
        },
        {
          id: "status",
          header: "Status",
          cell: ({ row }: { row: { original: AdminMessage } }) => statusText(row.original),
        },
        {
          id: "actions",
          header: "Akcje",
          cell: ({ row }: { row: { original: AdminMessage } }) => {
            const m = row.original;
            return (
              <span className="adm-zetony">
                {m.kind === "contact" ? (
                  <Button
                    variant="secondary"
                    disabled={!canHandle || busy === m.id}
                    title={denyReason(role, "content.write") ?? undefined}
                    aria-label={`${m.handled ? "Oznacz jako nowe" : "Oznacz jako obsłużone"}: zgłoszenie z ${formatDateTime(m.created_at)}`}
                    onClick={() => void toggle(m)}
                  >
                    {m.handled ? "Oznacz jako nowe" : "Oznacz jako obsłużone"}
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  disabled={!canDelete}
                  title={canDelete ? undefined : "Tylko właściciel usuwa zgłoszenia."}
                  aria-label={`Usuń zgłoszenie z ${formatDateTime(m.created_at)}`}
                  ref={(el: HTMLButtonElement | null) => {
                    if (el) triggers.current.set(m.id, el);
                    else triggers.current.delete(m.id);
                  }}
                  onClick={() => setToDelete(m)}
                >
                  Usuń
                </Button>
              </span>
            );
          },
        },
      ] as unknown as ColumnDef<AdminMessage, unknown>[],
    [canHandle, canDelete, busy, role],
  );

  const clearAll = () => url.clear();
  return (
    <div className="adm-strona">
      <QueryBoundary query={query} errorText="Nie udało się pobrać zgłoszeń.">
        {(data) => (
          <>
            <PageHeader title="Zgłoszenia" count={formatCount(data.total, MESSAGE_COUNT)} />
            <div className="adm-zetony" role="group" aria-label="Rodzaj zgłoszenia">
              <FilterChip active={!kind} onClick={() => url.set({ kind: undefined })}>
                Wszystkie
              </FilterChip>
              <FilterChip
                active={kind === "contact"}
                onClick={() => url.set({ kind: kind === "contact" ? undefined : "contact" })}
              >
                Kontakt
              </FilterChip>
              <FilterChip
                active={kind === "newsletter"}
                onClick={() => url.set({ kind: kind === "newsletter" ? undefined : "newsletter" })}
              >
                Newsletter
              </FilterChip>
            </div>
            {role === "viewer" ? (
              <p className="adm-powod">
                Konto viewer widzi dane zamaskowane. W demo nic nie jest wysyłane.
              </p>
            ) : (
              <p className="adm-powod">
                W demo nic nie jest wysyłane. Zgłoszenia są usuwane po 30 dniach.
              </p>
            )}
            <p className="tk-sr-only" role="status" aria-live="polite">
              {status}
            </p>
            {error ? <Alert variant="blad">{error}</Alert> : null}
            {data.items.length === 0 ? (
              <div className="adm-stos">
                <p>{url.hasAny ? "Nic tu nie pasuje do filtrów." : "Nie ma jeszcze zgłoszeń."}</p>
                {url.hasAny ? (
                  <div>
                    <Button variant="secondary" onClick={clearAll}>
                      Wyczyść filtry
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <DataTable
                caption="Zgłoszenia z formularzy"
                columns={columns}
                data={data.items}
                getRowId={(r) => r.id}
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
      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Usunąć zgłoszenie?"
        returnFocusRef={{
          get current() {
            return toDelete ? (triggers.current.get(toDelete.id) ?? null) : null;
          },
        }}
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Anuluj
            </Button>
            <Button loading={busy !== null} onClick={() => void remove()}>
              Usuń zgłoszenie
            </Button>
          </>
        }
      >
        <p>
          Zgłoszenie z {toDelete ? formatDateTime(toDelete.created_at) : ""} zostanie usunięte
          bezpowrotnie. W dzienniku zmian zostanie tylko rodzaj, numer i data zgłoszenia.
        </p>
      </Dialog>
    </div>
  );
}
