"use client";
// F-150, F-151, F-154, F-157 (docs/05 §6; wzorzec: tabela pozycji `view-cart.html` i koszyk wyskakujacy, docs/08 §6):
// lista pozycji i grup setow, wspolna dla szuflady (compact) i strony /koszyk. Ceny z wyceny API (docs/11 pulapka 20);
// ilosc i zawartosc z koszyka, wiec zmiana ilosci jest widoczna od razu, a cena dochodzi po wycenie.
import { formatPLN } from "@taktyl/domain";
import { Quantity, TextButton } from "@taktyl/ui";
import {
  builderHref,
  formatDiscount,
  setGroupTitle,
  setPercentOf,
  stockProblemText,
} from "../../lib/cart/messages";
import {
  BUILDER_STEP,
  MAX_ITEM_QTY,
  MAX_SET_QTY,
  categoryOfSku,
  lineKey,
  type CartItemLine,
  type CartLine,
  type CartSetLine,
  type CategoryId,
  type Quote,
} from "../../lib/cart/types";
import { Kwota } from "../motion/kwota";
import type { useCartActions } from "./use-cart-actions";

type Actions = ReturnType<typeof useCartActions>;
type QItem = Extract<Quote["lines"][number], { type: "item" }>;

interface Props {
  lines: readonly CartLine[];
  quote: Quote | null;
  actions: Actions;
  /** Szuflada: gestszy uklad bez opisu SKU w osobnym wierszu. */
  compact?: boolean;
  /** Wycena sie odswieza: ceny przygaszone, `aria-busy`. */
  busy?: boolean;
  /** Zamkniecie szuflady przy przejsciu do kreatora lub strony produktu. */
  onNavigate?: () => void;
  /** Poziom naglowkow pozycji: 2 na stronie (pod H1), 3 w szufladzie (pod H2 "Koszyk"). */
  level?: 2 | 3;
}

const CATEGORY_LIST_HREF: Record<CategoryId, string> = {
  klawiatury: "/klawiatury",
  myszki: "/myszki",
  podkladki: "/podkladki",
};

export function CartLines({
  lines,
  quote,
  actions,
  compact = false,
  busy = false,
  onNavigate,
  level = 2,
}: Props) {
  const { index } = actions;
  return (
    <ul
      className={compact ? "lista koszyk-lista koszyk-lista--ciasna" : "lista koszyk-lista"}
      aria-busy={busy || undefined}
    >
      {lines.map((line) => (
        <li key={lineKey(line)} className="koszyk-lista__wiersz">
          {line.type === "item" ? (
            <ItemRow
              line={line}
              quoted={index.items.get(line.sku)}
              problem={index.problems.get(line.sku)}
              quote={quote}
              actions={actions}
              onNavigate={onNavigate}
              busy={busy}
              level={level}
            />
          ) : (
            <SetGroup
              line={line}
              quoted={index.sets.get(line.id)}
              problems={index.problems}
              quote={quote}
              actions={actions}
              onNavigate={onNavigate}
              busy={busy}
              level={level}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function Heading({
  level,
  className,
  children,
}: {
  level: 2 | 3;
  className: string;
  children: React.ReactNode;
}) {
  const Tag = level === 2 ? "h2" : "h3";
  return <Tag className={className}>{children}</Tag>;
}

function Price({ gr, busy }: { gr: number | null; busy: boolean }) {
  if (gr === null) return <span className="koszyk-cena koszyk-cena--brak" aria-hidden="true" />;
  return (
    <span className={busy ? "koszyk-cena is-odswiezanie" : "koszyk-cena"}>{formatPLN(gr)}</span>
  );
}

function ItemRow({
  line,
  quoted,
  problem,
  quote,
  actions,
  onNavigate,
  busy,
  level,
}: {
  line: CartItemLine;
  quoted: QItem | undefined;
  problem: Quote["problems"][number] | undefined;
  quote: Quote | null;
  actions: Actions;
  onNavigate?: () => void;
  busy: boolean;
  level: 2 | 3;
}) {
  const name = quoted?.name ?? line.sku;
  const unknown = quote !== null && !quoted && problem?.code === "unknown_sku";
  const lacking = problem?.code === "out_of_stock";
  const lineTotal = quoted ? quoted.price_gr * line.qty : null;
  return (
    <article
      className={lacking || unknown ? "koszyk-poz is-problem" : "koszyk-poz"}
      aria-label={name}
    >
      <div className="koszyk-poz__opis">
        <Heading level={level} className="koszyk-poz__nazwa">
          {unknown ? "Pozycja niedostępna" : name}
        </Heading>
        <p className="koszyk-poz__sku">SKU: {line.sku}</p>
        {lacking || unknown ? (
          <ProblemNote
            text={
              unknown
                ? "Tej pozycji nie ma już w ofercie. Usuń ją z koszyka."
                : stockProblemText(problem?.available_qty)
            }
            href={CATEGORY_LIST_HREF[categoryOfSku(line.sku)]}
            onNavigate={onNavigate}
          />
        ) : null}
      </div>
      <div className="koszyk-poz__akcje">
        <Quantity
          label={`Ilość: ${name}`}
          value={line.qty}
          min={1}
          max={MAX_ITEM_QTY}
          onChange={(q) => actions.setQty(line, q)}
        />
        <Price gr={lineTotal} busy={busy} />
        {quoted && quoted.coupon_discount_gr > 0 ? (
          <span className="koszyk-poz__kod">Kod: {formatDiscount(quoted.coupon_discount_gr)}</span>
        ) : null}
        <TextButton
          className="koszyk-poz__usun"
          aria-label={`Usuń z koszyka: ${name}`}
          onClick={() => actions.removeLine(line)}
        >
          Usuń
        </TextButton>
      </div>
    </article>
  );
}

function ProblemNote({
  text,
  href,
  onNavigate,
}: {
  text: string;
  href: string;
  onNavigate?: () => void;
}) {
  return (
    <p className="koszyk-poz__problem" role="alert">
      <span>{text}</span>{" "}
      <a href={href} className="tk-link" onClick={onNavigate}>
        Wybierz inny wariant
      </a>
    </p>
  );
}

function SetGroup({
  line,
  quoted,
  problems,
  quote,
  actions,
  onNavigate,
  busy,
  level,
}: {
  line: CartSetLine;
  quoted: Extract<Quote["lines"][number], { type: "set" }> | undefined;
  problems: ReadonlyMap<string, Quote["problems"][number]>;
  quote: Quote | null;
  actions: Actions;
  onNavigate?: () => void;
  busy: boolean;
  level: 2 | 3;
}) {
  const percent = quoted ? setPercentOf(quoted) : 0;
  const skus = line.items.map((i) => i.sku);
  const firstLacking = skus.find((s) => problems.get(s)?.code === "out_of_stock");
  const unknown = quote !== null && !quoted;
  const heading = quoted ? setGroupTitle(percent) : "Twój set";
  const editHref = builderHref({ skus, profile: line.profile, editId: line.id });
  return (
    <section
      className={firstLacking || unknown ? "koszyk-set is-problem" : "koszyk-set"}
      aria-label={heading}
    >
      <header className="koszyk-set__naglowek">
        <Heading level={level} className="koszyk-set__tytul">
          {heading}
        </Heading>
        <a href={editHref} className="tk-link koszyk-set__edytuj" onClick={onNavigate}>
          Edytuj set
        </a>
      </header>
      <ul className="lista koszyk-set__elementy">
        {line.items.map((it) => {
          const q = quoted?.items.find((x) => x.sku === it.sku);
          const lacking = problems.get(it.sku)?.code === "out_of_stock";
          return (
            <li
              key={it.sku}
              className={lacking ? "koszyk-set__element is-problem" : "koszyk-set__element"}
            >
              <div className="koszyk-set__opis">
                <span className="koszyk-poz__nazwa">{q?.name ?? it.sku}</span>
                <span className="koszyk-poz__sku">SKU: {it.sku}</span>
                {lacking ? (
                  <ProblemNote
                    text={stockProblemText(problems.get(it.sku)?.available_qty)}
                    href={builderHref({
                      skus,
                      profile: line.profile,
                      step: BUILDER_STEP[categoryOfSku(it.sku)],
                      editId: line.id,
                    })}
                    onNavigate={onNavigate}
                  />
                ) : null}
              </div>
              <div className="koszyk-set__cena">
                <Price gr={q ? q.price_gr : null} busy={busy} />
                <TextButton
                  className="koszyk-poz__usun"
                  aria-label={`Usuń z setu: ${q?.name ?? it.sku}`}
                  onClick={() => actions.removeFromSet(line, it.sku)}
                >
                  Usuń z setu
                </TextButton>
              </div>
            </li>
          );
        })}
      </ul>
      <footer className="koszyk-set__stopka">
        <Quantity
          label="Ilość setów"
          value={line.qty}
          min={1}
          max={MAX_SET_QTY}
          onChange={(q) => actions.setQty(line, q)}
        />
        <dl className="koszyk-set__sumy">
          <div>
            <dt>Suma</dt>
            <dd>{quoted ? formatPLN(quoted.subtotal_gr) : ""}</dd>
          </div>
          <div>
            <dt>Rabat za set</dt>
            <dd>{quoted ? formatDiscount(quoted.set_discount_gr) : ""}</dd>
          </div>
          <div className="koszyk-set__razem">
            <dt>Razem</dt>
            <dd>{quoted ? <Kwota gr={quoted.total_gr} /> : ""}</dd>
          </div>
        </dl>
      </footer>
    </section>
  );
}
