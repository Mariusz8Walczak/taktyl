"use client";
// F-005 (wyszukiwarka z podpowiedziami), F-006 (synonimy po stronie API), F-242 (zdarzenie `search`).
// Wzorzec: okno wyszukiwania szablonu (formularz w nakladce, docs/08 §6), modul nakladek @taktyl/ui (pulapka
// fokusu, Esc, powrot fokusu na odnosnik "Szukaj"). Podpowiedzi: ARIA combobox + listbox z grupami,
// aria-activedescendant, strzalki + Enter. Skrot "/" to TAKTYL-59 (tu tylko podpowiedz <kbd>).
import { formatCount } from "@taktyl/domain";
import type { PluralForms } from "@taktyl/domain";
import { Dialog, Field, Kbd } from "@taktyl/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, RefObject } from "react";
import { NAV_MAIN, SEARCH_LINK } from "../../lib/nav";
import {
  GROUP_LABEL,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MIN_CHARS,
  SEARCH_SKELETON_MS,
  buildOptions,
  fetchSuggestions,
  highlightParts,
  searchResultsHref,
} from "../../lib/search/suggest";
import type { SuggestGroup, SuggestOption } from "../../lib/search/suggest";
import { track } from "../../lib/track";

type Status = "idle" | "loading" | "ready" | "error";

const RESULT_FORMS: PluralForms = { one: "podpowiedź", few: "podpowiedzi", many: "podpowiedzi" };
const GROUP_ORDER: SuggestGroup[] = ["products", "categories", "guides"];
const CATEGORY_LINKS = NAV_MAIN.slice(0, 3);

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, i) =>
        part.match ? (
          <mark key={i} className="szukaj__trafienie">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function Skeleton() {
  // A-18: szkielet z przesuwanym polyskiem (translateX), tylko w trakcie ladowania > 300 ms
  return (
    <div className="szukaj__szkielet" aria-hidden="true" data-testid="szukaj-szkielet">
      <span className="szukaj__wiersz-szkieletu" />
      <span className="szukaj__wiersz-szkieletu" />
      <span className="szukaj__wiersz-szkieletu" />
    </div>
  );
}

export function SearchBox() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SuggestOption[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [slow, setSlow] = useState(false);
  const [active, setActive] = useState(-1);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const uid = useId();
  const inputId = `${uid}-pole`;
  // fokus na polu po otwarciu okna (Field nie przyjmuje ref; pole jest znajdowane po id w chwili otwarcia)
  const inputRef = {
    get current() {
      return document.getElementById(inputId);
    },
  } as RefObject<HTMLElement | null>;
  const listId = `${uid}-lista`;
  const trimmed = query.trim();

  // Debounce + anulowanie poprzedniego zadania (AbortController); wyjatki sieci nie wywracaja pola.
  useEffect(() => {
    if (!open || trimmed.length < SEARCH_MIN_CHARS) {
      setStatus("idle");
      setOptions([]);
      setSlow(false);
      setActive(-1);
      return undefined;
    }
    const controller = new AbortController();
    let skeletonTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      setStatus("loading");
      skeletonTimer = setTimeout(() => setSlow(true), SEARCH_SKELETON_MS);
      fetchSuggestions(trimmed, controller.signal)
        .then((res) => {
          if (controller.signal.aborted) return;
          setOptions(buildOptions(res));
          setActive(-1);
          setStatus("ready");
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setOptions([]);
          setStatus("error");
        })
        .finally(() => {
          clearTimeout(skeletonTimer);
          if (!controller.signal.aborted) setSlow(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      clearTimeout(skeletonTimer);
      controller.abort();
    };
  }, [open, trimmed]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const go = (href: string) => {
    track("search", { search_term: trimmed });
    close();
    router.push(href);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed.length === 0) return;
    const chosen = active >= 0 ? options[active] : undefined;
    go(chosen ? chosen.href : searchResultsHref(trimmed));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (options.length === 0 || status !== "ready") return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    }
  };

  const listVisible = status === "ready" && options.length > 0;
  const showSkeleton = status === "loading" && slow;
  const empty = status === "ready" && options.length === 0;
  const liveText =
    status === "ready"
      ? options.length > 0
        ? formatCount(options.length, RESULT_FORMS)
        : "Brak wyników"
      : showSkeleton
        ? "Szukam"
        : "";

  return (
    <>
      <Link
        ref={triggerRef}
        href={SEARCH_LINK.href}
        className="naglowek__link"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        <span>{SEARCH_LINK.label}</span>
        <Kbd aria-hidden="true" className="naglowek__skrot">
          /
        </Kbd>
      </Link>
      <Dialog
        open={open}
        onClose={close}
        title="Wyszukiwarka"
        initialFocusRef={inputRef}
        returnFocusRef={triggerRef}
      >
        <form role="search" className="szukaj" onSubmit={onSubmit}>
          <Field
            id={inputId}
            label="Szukaj w sklepie"
            hint="Wpisz co najmniej dwa znaki, np. nazwę produktu albo „cicha”."
            type="text"
            name="q"
            value={query}
            maxLength={80}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={listVisible}
            aria-controls={listVisible ? listId : undefined}
            aria-activedescendant={listVisible && active >= 0 ? options[active]?.id : undefined}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <p className="tk-sr-only" role="status" aria-live="polite">
            {liveText}
          </p>
          <div className="szukaj__wyniki">
            {showSkeleton ? <Skeleton /> : null}
            {listVisible && !showSkeleton ? (
              <ul id={listId} role="listbox" aria-label="Podpowiedzi" className="szukaj__lista">
                {GROUP_ORDER.map((group) => {
                  const items = options.filter((o) => o.group === group);
                  if (items.length === 0) return null;
                  const headingId = `${uid}-${group}`;
                  return (
                    <li key={group} role="presentation">
                      <span id={headingId} className="szukaj__grupa">
                        {GROUP_LABEL[group]}
                      </span>
                      <ul role="group" aria-labelledby={headingId} className="lista">
                        {items.map((o) => (
                          <li
                            key={o.id}
                            id={o.id}
                            role="option"
                            aria-selected={options[active]?.id === o.id}
                            className="szukaj__opcja"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => go(o.href)}
                          >
                            <span>
                              <Highlighted text={o.label} query={trimmed} />
                            </span>
                            {o.hint ? <span className="szukaj__cena">{o.hint}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {empty ? (
              <div className="szukaj__pusto">
                <p>Brak wyników dla „{trimmed}”. Sprawdź pisownię albo zajrzyj do kategorii:</p>
                <ul className="lista lista--rzad">
                  {CATEGORY_LINKS.map((c) => (
                    <li key={c.href}>
                      <Link href={c.href} className="tk-link" onClick={close}>
                        {c.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {status === "error" ? (
              <p className="szukaj__blad">
                Nie udało się pobrać podpowiedzi. Naciśnij Enter, aby przejść do wyników.
              </p>
            ) : null}
          </div>
        </form>
      </Dialog>
    </>
  );
}
