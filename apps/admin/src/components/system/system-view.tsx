"use client";
// B-623 (docs/25 par. 2, audyt P2-6): "Jak to jest zrobione" - stos (wersje odczytane z uruchomionych uslug i z budowy
// panelu, nie wpisane recznie), kondycja uslug (API, baza, kolejka odswiezania, sklep), dane i migracje, architektura.
import { Alert, Button } from "@taktyl/ui";
import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { formatDateTime, formatInt } from "../../lib/format";
import { useSystem } from "../../lib/queries";
import { Card, SectionHead } from "../pulpit/blocks";
import { PageHeader } from "../ui/page-header";
import { Skeleton } from "../ui/skeleton";

const STATUS = {
  ok: { label: "działa", Icon: CircleCheck },
  uwaga: { label: "uwaga", Icon: CircleAlert },
  awaria: { label: "awaria", Icon: CircleX },
} as const;

const PANEL_STACK = [
  {
    name: "Next.js",
    version: process.env.STACK_NEXT ?? "?",
    role: "backpanel i sklep (App Router)",
  },
  { name: "React", version: process.env.STACK_REACT ?? "?", role: "interfejs" },
  {
    name: "TanStack Query",
    version: process.env.STACK_TANSTACK_QUERY ?? "?",
    role: "stan serwera w panelu",
  },
  {
    name: "Recharts",
    version: process.env.STACK_RECHARTS ?? "?",
    role: "wykresy pulpitu (kolory z tokenów)",
  },
];

const ARCH = [
  [
    "Monorepo",
    "pnpm + Turborepo: apps/api, apps/web, apps/admin, packages/contracts, packages/domain, packages/tokens, packages/ui (ADR-0002).",
  ],
  [
    "Kontrakt",
    "Schematy Zod w packages/contracts, wspólne dla API, sklepu i panelu; OpenAPI generowane z tych samych schematów.",
  ],
  [
    "Logika",
    "Ceny, rabat setu, kody, dostawa i konfigurator w packages/domain (czysta logika, bez I/O); API niczego nie liczy po swojemu.",
  ],
  [
    "Dane",
    "PostgreSQL + Prisma; data/*.json to seed. Najniższą cenę z 30 dni liczy API z historii cen (ADR-0005).",
  ],
  [
    "Propagacja",
    "Zapis w panelu: wpis w dzienniku i w kolejce outbox w tej samej transakcji, potem webhook rewalidacji sklepu (ADR-0003).",
  ],
  [
    "Pomiar",
    "Zdarzenia z docs/10 po zgodzie na analitykę trafiają do własnego kolektora POST /v1/events (ADR-0012).",
  ],
  [
    "Uruchomienie",
    "Wszystko w Docker Compose: baza, migracje, seed z historią demo, API, sklep, panel, proxy z noindex (ADR-0009).",
  ],
] as const;

export function SystemView() {
  const q = useSystem();
  return (
    <div className="adm-strona adm-pulpit">
      <PageHeader title="Jak to jest zrobione" />
      {q.isPending ? <Skeleton label="Wczytywanie stanu systemu" rows={6} /> : null}
      {q.isError ? (
        <div className="adm-stos" role="alert">
          <Alert variant="blad">Nie udało się pobrać stanu systemu.</Alert>
          <div>
            <Button variant="secondary" loading={q.isFetching} onClick={() => void q.refetch()}>
              Spróbuj ponownie
            </Button>
          </div>
        </div>
      ) : null}
      {q.data ? (
        <div className="adm-pulpit__sekcje">
          <section className="adm-sekcja" aria-labelledby="sys-uslugi">
            <SectionHead
              id="sys-uslugi"
              title="Kondycja usług"
              lead={`Sprawdzone ${formatDateTime(q.data.generated_at)}. Tryb demonstracyjny: ${q.data.demo_mode ? "włączony" : "wyłączony"}.`}
            />
            <div className="adm-siatka-12">
              {q.data.services.map((s) => {
                const st = STATUS[s.status];
                return (
                  <section
                    key={s.id}
                    className="adm-karta adm-kafel adm-kafel--3"
                    aria-labelledby={`sys-${s.id}`}
                  >
                    <h3 id={`sys-${s.id}`}>{s.label}</h3>
                    <p className={`adm-stan-uslugi adm-stan-uslugi--${s.status}`}>
                      <st.Icon aria-hidden="true" className="adm-ikona" />
                      {st.label}
                      {s.latency_ms !== null ? (
                        <span className="adm-tekst-slaby">, {formatInt(s.latency_ms)} ms</span>
                      ) : null}
                    </p>
                    <p className="adm-kafel__znaczenie">{s.detail}</p>
                  </section>
                );
              })}
            </div>
          </section>
          <section className="adm-sekcja" aria-labelledby="sys-stos">
            <SectionHead
              id="sys-stos"
              title="Stos"
              lead="Wersje odczytane z działających usług (API) i z budowy panelu."
            />
            <div className="adm-siatka-12">
              <Card id="sys-stos-tabela" title="Komponenty i wersje" span={7}>
                <div className="adm-tabela-okno">
                  <table className="adm-tabela adm-tabela--kompakt">
                    <caption className="tk-sr-only">Komponenty stosu i wersje</caption>
                    <thead>
                      <tr>
                        <th scope="col">Komponent</th>
                        <th scope="col">Wersja</th>
                        <th scope="col">Rola</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...q.data.stack, ...PANEL_STACK].map((s) => (
                        <tr key={s.name}>
                          <th scope="row">{s.name}</th>
                          <td className="adm-liczba-lewo">{s.version}</td>
                          <td>{s.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card
                id="sys-dane"
                title="Dane w bazie"
                span={5}
                meaning={`Migracje zastosowane: ${q.data.migrations.applied}, ostatnia: ${q.data.migrations.last ?? "brak"}.`}
              >
                <dl className="adm-dl adm-dl--kompakt">
                  {q.data.data.map((d) => (
                    <div key={d.id} className="adm-dl__wiersz">
                      <dt>{d.label}</dt>
                      <dd className="adm-liczba">{formatInt(d.count)}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>
          </section>
          <section className="adm-sekcja" aria-labelledby="sys-arch">
            <SectionHead
              id="sys-arch"
              title="Architektura w siedmiu zdaniach"
              lead="Decyzje są opisane w repozytorium w docs/adr."
            />
            <div className="adm-siatka-12">
              <Card id="sys-arch-lista" title="Jak to działa" span={12}>
                <dl className="adm-dl--kompakt adm-dl--opis">
                  {ARCH.map(([k, v]) => (
                    <div key={k} className="adm-dl__wiersz">
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
