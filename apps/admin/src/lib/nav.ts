// B-607, B-625 (docs/15 par. 4, docs/25 par. 3): nawigacja w grupach Start / Sprzedaz / Katalog / Tresci / System,
// ikony z zestawu Lucide (decyzja wlasciciela, docs/decyzje.md), liczniki z GET /v1/admin/stats/operations.
import type { OperationsStats } from "@taktyl/contracts";
import {
  Activity,
  BookOpen,
  CircleHelp,
  FileText,
  Files,
  Image,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  Package,
  ScrollText,
  Settings,
  ShoppingBag,
  Star,
  Wrench,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Licznik przy pozycji (liczba spraw do zalatwienia) i opis dla czytnika ekranu. */
  counter?: (ops: OperationsStats) => { value: number; label: string } | null;
  /** true = ekran powstaje w kolejnym zadaniu (pozycja wylaczona z etykieta "wkrotce"). */
  soon?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "start",
    label: "Start",
    items: [
      { href: "/", label: "Pulpit", icon: LayoutDashboard },
      { href: "/ruch", label: "Ruch", icon: Activity },
    ],
  },
  {
    id: "sprzedaz",
    label: "Sprzedaż",
    items: [
      {
        href: "/zamowienia",
        label: "Zamówienia",
        icon: ShoppingBag,
        counter: (o) =>
          o.waiting_orders.count > 0
            ? { value: o.waiting_orders.count, label: "opłacone ponad 24 godziny bez realizacji" }
            : null,
      },
      {
        href: "/zgloszenia",
        label: "Zgłoszenia",
        icon: Inbox,
        counter: (o) =>
          o.messages_unhandled > 0
            ? { value: o.messages_unhandled, label: "bez odpowiedzi" }
            : null,
      },
    ],
  },
  {
    id: "katalog",
    label: "Katalog",
    items: [
      {
        href: "/produkty",
        label: "Produkty",
        icon: Package,
        counter: (o) =>
          o.low_stock.out_of_stock > 0
            ? { value: o.low_stock.out_of_stock, label: "wariantów bez stanu" }
            : null,
      },
      {
        href: "/media",
        label: "Zdjęcia",
        icon: Image,
        counter: (o) =>
          o.images.total - o.images.ready > 0
            ? { value: o.images.total - o.images.ready, label: "zdjęć do wgrania" }
            : null,
      },
    ],
  },
  {
    id: "tresci",
    label: "Treści",
    items: [
      { href: "/tresci/opisy", label: "Opisy", icon: FileText },
      { href: "/tresci/opinie", label: "Opinie", icon: Star },
      { href: "/tresci/poradnik", label: "Poradnik", icon: BookOpen },
      { href: "/tresci/strony", label: "Strony", icon: Files },
      { href: "/tresci/faq", label: "FAQ", icon: CircleHelp },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/dziennik", label: "Dziennik zmian", icon: ScrollText },
      { href: "/ustawienia", label: "Ustawienia", icon: Settings },
      { href: "/system", label: "Jak to jest zrobione", icon: Wrench },
    ],
  },
];

/** Plaska lista (paleta polecen, testy). */
export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
