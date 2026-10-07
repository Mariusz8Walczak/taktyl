"use client";
// F-021...F-027, F-029, F-030, A-14 (wzorzec: `shop-filter-sidebar` + `shop-loadmore`, docs/08 §3): wyspa kliencka listingu.
// Pasek narzedzi (licznik z Intl.PluralRules, sortowanie, przelacznik siatki), kolumna filtrow (komputer) albo szuflada
// (telefon) z przyciskiem "Pokaz N produktow" aktualizowanym na zywo, zetony aktywnych filtrow, siatka kart
// (renderowana na serwerze, tu tylko opakowana) i "Pokaz wiecej".
// Stan filtrow, sortowania i strony zyje w ADRESIE (F-022): kazda zmiana filtra to router.push (Wstecz cofa filtr),
// "Pokaz wiecej" dopisuje `strona=N` przez history.replaceState. Karty i facety przychodza z serwera (RSC), wiec
// po zmianie adresu props sa swiezymi danymi z API; `useOptimistic` pokazuje wybor od razu, bez czekania na serwer.
import {
  activeFilterChips,
  formatCount,
  PRODUCT_FORMS,
  removeChip,
  type FacetDef,
  type FilterState,
  type SortKey,
} from "@taktyl/domain";
import type { TrackItem } from "../../lib/track-events";
import { Alert, Button, Field, FilterChip, TextButton } from "@taktyl/ui";
import { usePathname, useRouter } from "next/navigation";
import {
  Suspense,
  lazy,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
} from "react";
import { setBool, setNumber, setRange, toggleValue } from "../../lib/catalog/filter-actions";
import {
  activeFilterCount,
  sortOptionsFor,
  toSearch,
  type Facet,
} from "../../lib/catalog/listing-query";
import { track } from "../../lib/track";
import { FilterPanel, type FilterChange } from "./filter-panel";
import { loadMoreCards } from "./load-more-action";

export interface ListingShellProps {
  category: { id: string; name: string };
  facets: readonly Facet[];
  defs: readonly FacetDef[];
  state: FilterState;
  sort: SortKey;
  total: number;
  /** Adres bez `strona` - klucz widoku; zmienia sie przy kazdej zmianie filtra lub sortowania. */
  queryKey: string;
  swatches: Readonly<Record<string, string>>;
  /** Karty pierwszej partii (RSC) z ewentualna wstawka. */
  cards: ReactNode;
  /** Ile kart jest w `cards` i kursor kolejnej partii. */
  initialCount: number;
  nextCursor: string | null;
  initialPage: number;
  /** Pusty wynik: komunikat z propozycjami (RSC). */
  empty: ReactNode;
  /** `items[]` do view_item_list. */
  trackItems: readonly TrackItem[];
}

const loadDrawer = () => import("./listing-drawer");
const ListingDrawer = lazy(loadDrawer);

const NO_CTX = { switches: [], colors: {} } as const;

/** A-14 (docs/07 §3.5): View Transition z zapasem; bez wsparcia albo przy reduced-motion zmiana natychmiastowa. */
function withViewTransition(apply: () => void, resolveRef: { current: (() => void) | null }) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => Promise<void>) => unknown;
  };
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (!doc.startViewTransition || reduced) {
    apply();
    return;
  }
  doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        resolveRef.current = resolve;
        apply();
        // Siatka nie zostaje zamrozona, gdy odpowiedz serwera nie nadejdzie (zmiana adresu bez zmiany widoku).
        window.setTimeout(resolve, 1000);
      }),
  );
}

function describeChange(c: FilterChange): string {
  switch (c.kind) {
    case "toggle":
      return c.value;
    case "bool":
      return c.on ? "1" : "0";
    case "range":
      return `${c.minGr === null ? "" : Math.round(c.minGr / 100)}-${c.maxGr === null ? "" : Math.round(c.maxGr / 100)}`;
    case "number":
      return c.value === null ? "" : String(c.value);
  }
}

export function ListingShell(props: ListingShellProps) {
  const { category, facets, defs, state, sort, total, queryKey, swatches } = props;
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [optState, setOptState] = useOptimistic<FilterState, FilterState>(state, (_c, n) => n);
  const [optSort, setOptSort] = useOptimistic<SortKey, SortKey>(sort, (_c, n) => n);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // szuflada zostaje zamontowana po pierwszym uzyciu (animacja zamkniecia, powrot fokusu)
  const [drawerUsed, setDrawerUsed] = useState(false);
  const [cols, setCols] = useState<3 | 4>(3);
  const vtResolve = useRef<(() => void) | null>(null);

  // A-14: nowy widok jest w DOM - mozna zakonczyc przejscie
  useEffect(() => {
    vtResolve.current?.();
    vtResolve.current = null;
  }, [queryKey]);

  const currentSearch = toSearch({ filters: state, sort, page: 1 }, defs);

  function go(nextFilters: FilterState, nextSort: SortKey) {
    const search = toSearch({ filters: nextFilters, sort: nextSort, page: 1 }, defs);
    if (search === currentSearch) return; // np. Tab przez suwak bez zmiany wartosci
    withViewTransition(
      () =>
        startTransition(() => {
          setOptState(nextFilters);
          setOptSort(nextSort);
          router.push(`${pathname}${search}`, { scroll: false });
        }),
      vtResolve,
    );
  }

  function onFilterChange(c: FilterChange) {
    let next: FilterState;
    switch (c.kind) {
      case "toggle":
        next = toggleValue(optState, c.facetId, c.value);
        break;
      case "bool":
        next = setBool(optState, c.facetId, c.on);
        break;
      case "range":
        next = setRange(optState, c.facetId, c.minGr, c.maxGr, c.bounds);
        break;
      case "number":
        next = setNumber(optState, c.facetId, c.value);
        break;
    }
    if (toSearch({ filters: next, sort: optSort, page: 1 }, defs) !== currentSearch) {
      track("filter_apply", {
        item_list_id: category.id,
        filter_name: c.facetId,
        filter_value: describeChange(c),
      });
    }
    go(next, optSort);
  }

  const chips = activeFilterChips(optState, defs as FacetDef[], NO_CTX);
  const filterCount = activeFilterCount(optState);
  const countLabel = formatCount(total, PRODUCT_FORMS);
  const sortOptions = sortOptionsFor(category.id);

  // view_item_list: raz na widok (listing + wyniki), gdy siatka jest w polu widzenia (docs/10 §4)
  const gridRef = useRef<HTMLDivElement>(null);
  const viewedKey = useRef<string | null>(null);
  useEffect(() => {
    const el = gridRef.current;
    if (!el || props.trackItems.length === 0 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && viewedKey.current !== queryKey) {
        viewedKey.current = queryKey;
        track("view_item_list", {
          items: [...props.trackItems],
          item_list_id: category.id,
          item_list_name: category.name,
        });
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [queryKey, props.trackItems, category.id, category.name]);

  // select_item: delegacja klikniec w karty (karty sa komponentami serwerowymi z `data-track-item`)
  function onGridClick(e: MouseEvent<HTMLElement>) {
    const target = e.target as Element;
    if (!target.closest("a")) return;
    const li = target.closest("[data-track-item]");
    const raw = li?.getAttribute("data-track-item");
    if (!raw) return;
    try {
      track("select_item", {
        items: [JSON.parse(raw) as TrackItem],
        item_list_id: category.id,
        item_list_name: category.name,
      });
    } catch {
      /* uszkodzony atrybut nie zrywa nawigacji */
    }
  }

  const panel = (
    <FilterPanel facets={facets} state={optState} swatches={swatches} onChange={onFilterChange} />
  );

  return (
    <div className="listing">
      <aside className="listing__filtry" aria-label="Filtry">
        <h2 className="listing__filtry-naglowek">Filtry</h2>
        {panel}
      </aside>

      <div className="listing__glowna">
        <div className="pasek-narzedzi">
          <p
            className="pasek-narzedzi__licznik"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {countLabel}
          </p>
          <Button
            variant="secondary"
            className="pasek-narzedzi__filtry"
            aria-haspopup="dialog"
            onPointerEnter={() => void loadDrawer()}
            onFocus={() => void loadDrawer()}
            onClick={() => {
              setDrawerUsed(true);
              setDrawerOpen(true);
            }}
          >
            {filterCount > 0 ? `Filtry (${filterCount})` : "Filtry"}
          </Button>
          <Field
            as="select"
            label="Sortuj"
            wrapperClassName="pasek-narzedzi__sort"
            value={optSort}
            onChange={(e) => go(optState, e.target.value as SortKey)}
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Field>
          <div className="pasek-narzedzi__siatka" role="group" aria-label="Układ siatki">
            {([3, 4] as const).map((n) => (
              <Button
                key={n}
                variant="secondary"
                aria-pressed={cols === n}
                className={cols === n ? "is-wybrany" : undefined}
                onClick={() => setCols(n)}
              >
                {n} kolumny
              </Button>
            ))}
          </div>
        </div>

        {chips.length > 0 ? (
          <div className="zetony" role="group" aria-label="Aktywne filtry">
            <ul className="lista zetony__lista">
              {chips.map((chip) => (
                <li key={`${chip.facetId}:${chip.value ?? ""}`}>
                  <FilterChip
                    active
                    aria-label={`Usuń filtr: ${chip.label}`}
                    onClick={() => go(removeChip(optState, chip), optSort)}
                  >
                    {chip.label} <span aria-hidden="true">×</span>
                  </FilterChip>
                </li>
              ))}
            </ul>
            <TextButton onClick={() => go({}, optSort)}>Wyczyść wszystko</TextButton>
          </div>
        ) : null}

        <div ref={gridRef} onClick={onGridClick}>
          {total === 0 ? (
            props.empty
          ) : (
            <GridSection
              key={queryKey}
              category={category}
              cols={cols}
              cards={props.cards}
              initialCount={props.initialCount}
              total={total}
              nextCursor={props.nextCursor}
              initialPage={props.initialPage}
            />
          )}
        </div>
      </div>

      {drawerUsed ? (
        <Suspense fallback={null}>
          <ListingDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            footer={<Button onClick={() => setDrawerOpen(false)}>{`Pokaż ${countLabel}`}</Button>}
          >
            {panel}
          </ListingDrawer>
        </Suspense>
      ) : null}
    </div>
  );
}

interface GridSectionProps {
  category: { id: string; name: string };
  cols: 3 | 4;
  cards: ReactNode;
  initialCount: number;
  total: number;
  nextCursor: string | null;
  initialPage: number;
}

/**
 * F-026: siatka + "Pokaz wiecej" (12 na raz, kursor z API). Nowe karty przychodza z akcji serwerowej jako RSC,
 * fokus przechodzi na pierwszy nowy produkt, adres dostaje `strona=N` (replaceState: odswiezenie odtwarza widok).
 */
function GridSection(p: GridSectionProps) {
  const [extra, setExtra] = useState<ReactNode[]>([]);
  const [cursor, setCursor] = useState(p.nextCursor);
  const [shown, setShown] = useState(p.initialCount);
  const [page, setPage] = useState(p.initialPage);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const focusFrom = useRef<number | null>(null);

  useEffect(() => {
    const from = focusFrom.current;
    if (from === null) return;
    focusFrom.current = null;
    const cards = listRef.current?.querySelectorAll("li.karta");
    (cards?.[from]?.querySelector("a") as HTMLElement | null | undefined)?.focus();
    // view_item_list nowej partii (docs/10 §4: raz na liste i strone wynikow)
    const fresh = Array.from(cards ?? [])
      .slice(from)
      .map((li) => li.getAttribute("data-track-item"))
      .filter((x): x is string => x !== null);
    if (fresh.length > 0) {
      try {
        track("view_item_list", {
          items: fresh.map((x) => JSON.parse(x) as TrackItem),
          item_list_id: p.category.id,
          item_list_name: p.category.name,
        });
      } catch {
        /* pomiar nigdy nie zrywa strony */
      }
    }
  }, [extra, p.category.id, p.category.name]);

  async function showMore() {
    if (!cursor || busy) return;
    setBusy(true);
    setFailed(false);
    const before = listRef.current?.querySelectorAll("li.karta").length ?? shown;
    try {
      const res = await loadMoreCards({
        category: p.category.id,
        search: window.location.search,
        cursor,
        startIndex: before,
      });
      focusFrom.current = before;
      setExtra((e) => [...e, res.nodes]);
      setCursor(res.nextCursor);
      setShown((n) => n + res.count);
      const nextPage = page + 1;
      setPage(nextPage);
      const url = new URL(window.location.href);
      url.searchParams.set("strona", String(nextPage));
      window.history.replaceState(window.history.state, "", url);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="tk-sr-only">Produkty</h2>
      <ul
        ref={listRef}
        className="lista siatka"
        data-kolumny={p.cols}
        aria-busy={busy || undefined}
      >
        {p.cards}
        {extra}
      </ul>
      {failed ? (
        <Alert variant="blad">Nie udało się pobrać kolejnych produktów. Spróbuj ponownie.</Alert>
      ) : null}
      {cursor ? (
        <div className="wiecej">
          <p className="wiecej__stan">{`Wyświetlono ${shown} z ${p.total} produktów`}</p>
          <Button variant="secondary" loading={busy} onClick={showMore}>
            Pokaż więcej
          </Button>
        </div>
      ) : null}
    </>
  );
}
