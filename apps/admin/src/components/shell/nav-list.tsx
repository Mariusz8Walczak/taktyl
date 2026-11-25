"use client";
// B-607, B-625 (docs/25 par. 3): nawigacja w grupach z ikonami Lucide i licznikami spraw (z operacji pulpitu).
// Licznik ma tekst dla czytnika ekranu ("3 bez odpowiedzi"); w trybie zwinietym etykieta zostaje w aria-label i title.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOperations } from "../../lib/queries";
import { isActive, NAV_GROUPS } from "../../lib/nav";

export function NavList({
  onNavigate,
  collapsed = false,
  counters = true,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  /** Liczniki dopiero po zalogowaniu (bez sesji API zwraca 401). */
  counters?: boolean;
}) {
  const pathname = usePathname();
  const ops = useOperations(counters);
  return (
    <div className="adm-nawigacja">
      {NAV_GROUPS.map((group) => (
        <div key={group.id} className="adm-nawigacja__grupa">
          <h2 className="adm-nawigacja__naglowek" id={`nav-${group.id}`}>
            {group.label}
          </h2>
          <ul aria-labelledby={`nav-${group.id}`}>
            {group.items.map((item) => {
              const Icon = item.icon;
              const counter = ops.data && item.counter ? item.counter(ops.data) : null;
              const current = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  {item.soon ? (
                    <span className="adm-nawigacja__wylaczone" aria-disabled="true">
                      <Icon aria-hidden="true" className="adm-ikona" />
                      <span className="adm-nawigacja__etykieta">{item.label}</span>
                      <span className="adm-nawigacja__wkrotce">wkrótce</span>
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className="adm-nawigacja__link"
                      aria-current={current ? "page" : undefined}
                      aria-label={
                        collapsed
                          ? item.label + (counter ? `, ${counter.value} ${counter.label}` : "")
                          : undefined
                      }
                      title={collapsed ? item.label : undefined}
                      onClick={onNavigate}
                    >
                      <Icon aria-hidden="true" className="adm-ikona" />
                      <span className="adm-nawigacja__etykieta">{item.label}</span>
                      {counter ? (
                        <span className="adm-licznik-menu">
                          <span aria-hidden="true">{counter.value}</span>
                          <span className="tk-sr-only">
                            {counter.value} {counter.label}
                          </span>
                        </span>
                      ) : null}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
