"use client";
// B-011, B-012 (docs/15 par. 6): /dziennik - dziennik zmian (audit_log). Filtry w adresie (uzytkownik, encja, zakres dat w
// Europe/Warsaw), licznik z odmiana, paginacja page/per_page, szczegoly wpisu w oknie z roznica przed -> po (lista zmienionych
// pol). Dane osobowe sa juz zamaskowane w odpowiedzi API dla viewera (B-008); panel niczego nie odslania.
import type { auditEntrySchema } from "@taktyl/contracts";
import { Button, Dialog, Field } from "@taktyl/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { ACTION_LABEL, diffAudit, ENTITY_LABEL, ENTRY_COUNT } from "../../lib/audit-labels";
import { formatCount, formatDateTime } from "../../lib/format";
import { useAudit, type AuditListParams } from "../../lib/queries";
import { useUrlState } from "../../lib/use-url-state";
import { warsawIso } from "../../lib/warsaw";
import { DataTable } from "../ui/data-table";
import { PageHeader } from "../ui/page-header";
import { Pagination } from "../ui/pagination";
import { QueryBoundary } from "../ui/query-state";

type Entry = z.infer<typeof auditEntrySchema>;
const PER_PAGE = 25;
const ROLE_LABEL = {
  owner: "właściciel",
  editor: "edytor",
  viewer: "viewer",
  system: "system",
} as const;

function Details({
  entry,
  onClose,
  returnFocus,
}: {
  entry: Entry;
  onClose: () => void;
  returnFocus: HTMLElement | null;
}) {
  const changes = diffAudit(entry.before, entry.after);
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Wpis ${entry.id}: ${ACTION_LABEL[entry.action] ?? entry.action}`}
      returnFocusRef={{ current: returnFocus }}
      footer={<Button onClick={onClose}>Zamknij</Button>}
    >
      <div className="adm-stos">
        <dl className="adm-dl">
          <dt>Kiedy</dt>
          <dd>{formatDateTime(entry.at)}</dd>
          <dt>Kto</dt>
          <dd>
            {ROLE_LABEL[entry.actor_role]}
            {entry.actor_id ? `, konto ${entry.actor_id}` : ""}
          </dd>
          <dt>Encja</dt>
          <dd>
            {ENTITY_LABEL[entry.entity] ?? entry.entity} {entry.entity_id}
          </dd>
          <dt>Akcja</dt>
          <dd>{entry.action}</dd>
          <dt>Żądanie</dt>
          <dd>{entry.request_id}</dd>
        </dl>
        <h3>Zmienione pola</h3>
        {changes.length === 0 ? (
          <p>Brak różnic w polach.</p>
        ) : (
          <div className="adm-tabela-okno" role="region" aria-label="Zmienione pola" tabIndex={0}>
            <table className="adm-roznica">
              <caption className="tk-sr-only">Zmienione pola wpisu {entry.id}</caption>
              <thead>
                <tr>
                  <th scope="col">Pole</th>
                  <th scope="col">Przed</th>
                  <th scope="col">Po</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.path}>
                    <th scope="row">{c.path}</th>
                    <td>{c.before}</td>
                    <td>{c.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Dialog>
  );
}

export function AuditView() {
  const url = useUrlState();
  const [actor, setActor] = useState(url.get("actor_id"));
  useEffect(() => {
    const t = setTimeout(() => {
      if (actor !== url.get("actor_id")) url.set({ actor_id: actor.trim() || undefined });
    }, 300);
    return () => clearTimeout(t);
  }, [actor]);

  const from = url.get("from");
  const to = url.get("to");
  const params: AuditListParams = {
    page: Number(url.get("page")) || 1,
    per_page: PER_PAGE,
    ...(url.get("entity") ? { entity: url.get("entity") } : {}),
    ...(url.get("actor_id") ? { actor_id: url.get("actor_id") } : {}),
    ...(from ? { from: warsawIso(from, "00:00:00") } : {}),
    ...(to ? { to: warsawIso(to, "23:59:59") } : {}),
  };
  const query = useAudit(params);
  const [open, setOpen] = useState<Entry | null>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());

  const columns = useMemo<ColumnDef<Entry, unknown>[]>(
    () =>
      [
        {
          id: "at",
          header: "Kiedy",
          meta: { sticky: true },
          cell: ({ row }: { row: { original: Entry } }) => formatDateTime(row.original.at),
        },
        {
          id: "who",
          header: "Kto",
          cell: ({ row }: { row: { original: Entry } }) => (
            <>
              {ROLE_LABEL[row.original.actor_role]}
              {row.original.actor_id ? `, ${row.original.actor_id}` : ""}
            </>
          ),
        },
        {
          id: "action",
          header: "Co",
          cell: ({ row }: { row: { original: Entry } }) =>
            ACTION_LABEL[row.original.action] ?? row.original.action,
        },
        {
          id: "entity",
          header: "Encja",
          cell: ({ row }: { row: { original: Entry } }) =>
            `${ENTITY_LABEL[row.original.entity] ?? row.original.entity} ${row.original.entity_id}`,
        },
        {
          id: "details",
          header: "Szczegóły",
          cell: ({ row }: { row: { original: Entry } }) => (
            <Button
              variant="secondary"
              aria-label={`Szczegóły wpisu ${row.original.id}`}
              ref={(el: HTMLButtonElement | null) => {
                if (el) triggers.current.set(row.original.id, el);
                else triggers.current.delete(row.original.id);
              }}
              onClick={() => setOpen(row.original)}
            >
              Szczegóły
            </Button>
          ),
        },
      ] as unknown as ColumnDef<Entry, unknown>[],
    [],
  );

  return (
    <div className="adm-strona">
      <PageHeader
        title="Dziennik zmian"
        count={query.data ? formatCount(query.data.total, ENTRY_COUNT) : undefined}
      />
      <div className="adm-narzedzia" role="search" aria-label="Filtry dziennika">
        <Field
          label="Użytkownik (ID konta)"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
        />
        <Field
          as="select"
          label="Encja"
          value={url.get("entity")}
          onChange={(e) => url.set({ entity: e.target.value })}
        >
          <option value="">Wszystkie</option>
          {Object.entries(ENTITY_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Field>
        <Field
          label="Od dnia"
          type="date"
          value={from}
          onChange={(e) => url.set({ from: e.target.value })}
        />
        <Field
          label="Do dnia"
          type="date"
          value={to}
          onChange={(e) => url.set({ to: e.target.value })}
        />
      </div>
      <QueryBoundary query={query} errorText="Nie udało się pobrać dziennika.">
        {(data) =>
          data.items.length === 0 ? (
            <div className="adm-stos">
              <p>{url.hasAny ? "Nic tu nie pasuje do filtrów." : "Dziennik jest pusty."}</p>
              {url.hasAny ? (
                <div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setActor("");
                      url.clear();
                    }}
                  >
                    Wyczyść filtry
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <DataTable
                caption="Dziennik zmian"
                columns={columns}
                data={data.items}
                getRowId={(r) => r.id}
              />
              <Pagination
                page={data.page}
                perPage={data.per_page}
                total={data.total}
                onPage={(p) => url.set({ page: String(p) }, true)}
              />
            </>
          )
        }
      </QueryBoundary>
      {open ? (
        <Details
          key={open.id}
          entry={open}
          returnFocus={triggers.current.get(open.id) ?? null}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}
