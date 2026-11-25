"use client";
// B-626 (docs/25 par. 3): paleta polecen i wyszukiwarka globalna (Ctrl+K, Cmd+K albo "/" poza polem tekstowym).
// Okno z pulapka fokusu (Dialog z @taktyl/ui), pole combobox + lista opcji (strzalki, Enter, Esc). Wyniki: ekrany panelu,
// produkty (nazwa, SKU) i zamowienia (numer) z GET /v1/admin/search, akcje (motyw).
import { normalizeSearchText } from "@taktyl/domain";
import { Dialog } from "@taktyl/ui";
import { CornerDownLeft, Moon, Package, Search, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { formatPLN, ORDER_STATUS_LABEL } from "../../lib/format";
import { NAV_ITEMS } from "../../lib/nav";
import { useAdminSearch } from "../../lib/queries";

interface Option {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

function useDebounced(value: string, ms: number): string {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function CommandPalette({
  open,
  onClose,
  onToggleTheme,
}: {
  open: boolean;
  onClose: () => void;
  onToggleTheme: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const debounced = useDebounced(q, 200);
  const search = useAdminSearch(debounced);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const options = useMemo<Option[]>(() => {
    const needle = normalizeSearchText(q.trim());
    const pages = NAV_ITEMS.filter(
      (i) => !i.soon && (needle === "" || normalizeSearchText(i.label).includes(needle)),
    ).map((i): Option => {
      const Icon = i.icon;
      return {
        id: `strona-${i.href}`,
        group: "Ekrany",
        label: i.label,
        icon: <Icon aria-hidden="true" className="adm-ikona" />,
        run: () => go(i.href),
      };
    });
    const actions: Option[] =
      needle === "" || "motyw ciemny jasny".includes(needle)
        ? [
            {
              id: "akcja-motyw",
              group: "Akcje",
              label: "Przełącz motyw (jasny / ciemny)",
              icon: <Moon aria-hidden="true" className="adm-ikona" />,
              run: () => {
                onToggleTheme();
                onClose();
              },
            },
          ]
        : [];
    const found = q.trim().length >= 2 && search.data ? search.data : null;
    const products: Option[] = (found?.products ?? []).map((p) => ({
      id: `produkt-${p.id}-${p.sku ?? ""}`,
      group: "Produkty",
      label: p.name,
      hint: p.sku ?? (p.status === "archived" ? "zarchiwizowany" : undefined),
      icon: <Package aria-hidden="true" className="adm-ikona" />,
      run: () => go(`/produkty/${encodeURIComponent(p.id)}${p.sku ? "?zakladka=warianty" : ""}`),
    }));
    const orders: Option[] = (found?.orders ?? []).map((o) => ({
      id: `zamowienie-${o.number}`,
      group: "Zamówienia",
      label: o.number,
      hint: `${ORDER_STATUS_LABEL[o.status]}, ${formatPLN(o.total_gr)}`,
      icon: <ShoppingBag aria-hidden="true" className="adm-ikona" />,
      run: () => go(`/zamowienia/${encodeURIComponent(o.number)}`),
    }));
    return [...products, ...orders, ...pages, ...actions];
    // go i onClose sa stabilne w czasie zycia okna
  }, [q, search.data]);

  useEffect(() => {
    if (active >= options.length) setActive(Math.max(0, options.length - 1));
  }, [options.length, active]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (options.length === 0 ? 0 : (a + 1) % options.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (options.length === 0 ? 0 : (a - 1 + options.length) % options.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      options[active]?.run();
    }
  };

  let lastGroup = "";
  const searching = q.trim().length >= 2 && search.isFetching;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Szukaj i przejdź"
      initialFocusRef={inputRef}
      className="adm-paleta"
    >
      <div className="adm-paleta__pole">
        <Search aria-hidden="true" className="adm-ikona" />
        <label htmlFor={`${listId}-pole`} className="tk-sr-only">
          Szukaj produktu, SKU, numeru zamówienia albo ekranu
        </label>
        <input
          id={`${listId}-pole`}
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder="Produkt, SKU, numer zamówienia albo ekran"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
        />
      </div>
      <p className="adm-paleta__stan" aria-live="polite">
        {searching
          ? "Szukam…"
          : q.trim().length >= 2
            ? `Wyniki: ${options.length}`
            : "Wpisz co najmniej 2 znaki, aby szukać w danych."}
      </p>
      <ul id={listId} role="listbox" aria-label="Wyniki" className="adm-paleta__lista">
        {options.map((o, i) => {
          const header = o.group !== lastGroup ? o.group : null;
          lastGroup = o.group;
          return (
            <li
              key={o.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="adm-paleta__opcja"
              data-grupa={header ?? undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => o.run()}
            >
              {o.icon}
              <span className="adm-paleta__etykieta">{o.label}</span>
              {o.hint ? <span className="adm-paleta__podpowiedz">{o.hint}</span> : null}
              {i === active ? (
                <CornerDownLeft aria-hidden="true" className="adm-ikona adm-paleta__enter" />
              ) : null}
            </li>
          );
        })}
      </ul>
      {options.length === 0 ? (
        <p className="adm-tekst-slaby">
          Nic nie pasuje. Spróbuj nazwy produktu albo końcówki numeru zamówienia.
        </p>
      ) : null}
    </Dialog>
  );
}
