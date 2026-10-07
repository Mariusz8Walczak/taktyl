"use client";
// F-242, F-040 (docs/10 §3-§4): pomiar list na stronie glownej - `view_item_list` raz, gdy lista wchodzi w pole
// widzenia (IntersectionObserver), i `select_item` po kliknieciu odnosnika w karcie. Karty sa komponentami serwerowymi
// z atrybutem `data-track-item` (jedna pozycja) albo `data-track-items` (set: trzy pozycje). Zdarzenia tylko przez
// `track()` (regula 9); nazwy i parametry bez zmian wzgledem docs/10.
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { track } from "../../lib/track";
import type { TrackItem } from "../../lib/track-events";

export interface ListTrackerProps {
  listId: string;
  listName: string;
  /** `items[]` do view_item_list. */
  items: readonly TrackItem[];
  className?: string;
  children: ReactNode;
}

function readItems(el: Element | null): TrackItem[] | null {
  const single = el?.getAttribute("data-track-item");
  const many = el?.getAttribute("data-track-items");
  try {
    if (many) return JSON.parse(many) as TrackItem[];
    if (single) return [JSON.parse(single) as TrackItem];
  } catch {
    /* uszkodzony atrybut nie zrywa nawigacji */
  }
  return null;
}

export function ListTracker({ listId, listName, items, className, children }: ListTrackerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const viewed = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || items.length === 0 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (viewed.current || !entries.some((e) => e.isIntersecting)) return;
      viewed.current = true;
      track("view_item_list", {
        items: [...items],
        item_list_id: listId,
        item_list_name: listName,
      });
      io.disconnect();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [items, listId, listName]);

  function onClick(e: MouseEvent<HTMLDivElement>) {
    const target = e.target as Element;
    if (!target.closest("a")) return;
    const picked = readItems(target.closest("[data-track-item], [data-track-items]"));
    if (!picked) return;
    track("select_item", { items: picked, item_list_id: listId, item_list_name: listName });
  }

  return (
    // Delegacja klikniec: odnosniki w kartach pozostaja zwyklymi <a> (dzialaja bez JS).
    <div ref={ref} className={className} onClick={onClick}>
      {children}
    </div>
  );
}
