"use client";
// F-007, F-242 (docs/10 §4: view_item_list raz na liste, select_item po kliknieciu karty): siatka kart wynikow
// wyszukiwania. Karty sa serwerowe i niosa `data-track-item`; ten maly komponent czyta je z DOM, nadaje liscie
// id/nazwe wynikow i wysyla zdarzenia przez jedyny modul `track`. Zdarzenie `search` wysyla okno wyszukiwarki.
import { useEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import { track } from "../../lib/track";
import type { TrackItem } from "../../lib/track-events";

function readItems(root: HTMLElement, listId: string, listName: string): TrackItem[] {
  const out: TrackItem[] = [];
  root.querySelectorAll<HTMLElement>("[data-track-item]").forEach((el, index) => {
    try {
      const item = JSON.parse(el.getAttribute("data-track-item") ?? "") as TrackItem;
      out.push({ ...item, item_list_id: listId, item_list_name: listName, index });
    } catch {
      /* uszkodzony atrybut pomijamy */
    }
  });
  return out;
}

export function TrackedGrid({
  listId,
  listName,
  children,
  columns = 4,
}: {
  listId: string;
  listName: string;
  children: ReactNode;
  columns?: 3 | 4;
}) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fire = () => {
      const items = readItems(el, listId, listName);
      if (items.length > 0)
        track("view_item_list", { items, item_list_id: listId, item_list_name: listName });
    };
    if (typeof IntersectionObserver === "undefined") {
      fire();
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        fire();
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [listId, listName]);

  function onClick(e: MouseEvent<HTMLUListElement>) {
    const target = e.target as Element;
    if (!target.closest("a")) return;
    const li = target.closest<HTMLElement>("[data-track-item]");
    if (!li || !ref.current) return;
    const siblings = Array.from(ref.current.querySelectorAll("[data-track-item]"));
    try {
      const item = JSON.parse(li.getAttribute("data-track-item") ?? "") as TrackItem;
      track("select_item", {
        items: [
          { ...item, item_list_id: listId, item_list_name: listName, index: siblings.indexOf(li) },
        ],
        item_list_id: listId,
        item_list_name: listName,
      });
    } catch {
      /* uszkodzony atrybut nie zrywa nawigacji */
    }
  }

  return (
    <ul ref={ref} className="lista siatka" data-kolumny={columns} onClick={onClick}>
      {children}
    </ul>
  );
}
