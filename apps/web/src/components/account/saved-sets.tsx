"use client";
// F-203, F-114 (docs/05 §1 `/konto/sety`; wzorzec: lista zapisanych elementow konta, docs/08 §6): zapisane sety z
// `taktyl.sets.v1` - otworz w kreatorze, zmien nazwe, usun z "Cofnij". Maks. 10; przy limicie komunikat. Nazwy i ceny
// pozycji z katalogu (API); sam set nie przechowuje cen.
import { formatPLN } from "@taktyl/domain";
import { Button, Field, InlineMessage, TextButton, useToast, VisuallyHidden } from "@taktyl/ui";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { describeSet, sumLines, SLOT_NAME } from "../../lib/account/describe";
import { useHydrated, useSavedSets } from "../../lib/account/hooks";
import {
  SET_NAME_MAX,
  SETS_MAX,
  builderHref,
  savedSets,
  type SavedSet,
} from "../../lib/account/sets";
import type { LiteProduct } from "../../lib/compare/lite";
import { formatDateTime } from "../../lib/account/orders";

const UNDO_MS = 6000;

function SetCard({
  set,
  catalog,
  timeZone,
}: {
  set: SavedSet;
  catalog: readonly LiteProduct[];
  timeZone: string;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(set.name);
  const [error, setError] = useState<string | null>(null);
  const lines = describeSet(set, catalog);
  const sum = sumLines(lines);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (savedSets.rename(set.id, name)) {
      setEditing(false);
      setError(null);
      toast({ message: "Nazwa zmieniona" });
    } else {
      setError("Wpisz nazwę setu.");
    }
  };

  const remove = () => {
    const removed = savedSets.remove(set.id);
    if (!removed) return;
    toast({
      message: `Usunięto set „${removed.set.name}”`,
      actionLabel: "Cofnij",
      duration: UNDO_MS,
      onAction: () => {
        savedSets.restore(removed.set, removed.index);
      },
    });
  };

  return (
    <li className="konto-set">
      <div className="konto-set__glowa">
        {editing ? (
          <form onSubmit={submit} className="konto-set__zmiana" noValidate>
            <Field
              label="Nowa nazwa setu"
              value={name}
              maxLength={SET_NAME_MAX}
              autoComplete="off"
              error={error}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <div className="konto-set__akcje">
              <Button type="submit">Zapisz nazwę</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  setName(set.name);
                  setError(null);
                }}
              >
                Anuluj
              </Button>
            </div>
          </form>
        ) : (
          <h3 className="konto-set__nazwa">{set.name}</h3>
        )}
        {set.at ? (
          <p className="konto-set__data">Zapisany: {formatDateTime(set.at, timeZone)}</p>
        ) : null}
      </div>
      <ul className="lista konto-set__pozycje">
        {lines.map((l) => (
          <li key={l.slot}>
            <span className="konto-set__typ">{SLOT_NAME[l.slot]}:</span>{" "}
            {l.product && l.variant ? (
              <>
                <Link href={`${l.product.href}?sku=${l.sku}`} className="tk-link">
                  {l.product.name}
                </Link>
                <span className="konto-set__wariant"> · {l.variant.label}</span>
              </>
            ) : (
              <span>Ten produkt nie jest już w katalogu</span>
            )}
          </li>
        ))}
      </ul>
      {sum !== null ? (
        <p className="konto-set__suma">Suma pozycji (bez rabatu za set): {formatPLN(sum)}</p>
      ) : null}
      {!editing ? (
        <div className="konto-set__akcje">
          <Link href={builderHref(set)} className="tk-btn tk-btn--glowny">
            Otwórz w kreatorze<VisuallyHidden>: {set.name}</VisuallyHidden>
          </Link>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Zmień nazwę<VisuallyHidden>: {set.name}</VisuallyHidden>
          </Button>
          <TextButton className="konto-set__usun" onClick={remove}>
            Usuń set<VisuallyHidden>: {set.name}</VisuallyHidden>
          </TextButton>
        </div>
      ) : null}
    </li>
  );
}

export function SavedSetsPage({
  catalog,
  timeZone,
}: {
  catalog: readonly LiteProduct[];
  timeZone: string;
}) {
  const hydrated = useHydrated();
  const sets = useSavedSets();
  if (!hydrated) return null;

  if (sets.length === 0) {
    return (
      <div className="pusty-stan">
        <p className="pusty-stan__tekst">
          Nie masz jeszcze zapisanych setów. W kreatorze, na kroku „Podsumowanie”, użyj przycisku
          „Zapisz set”. Możesz mieć do {SETS_MAX} setów.
        </p>
        <div className="pusty-stan__akcje">
          <Link href="/zbuduj-set" className="tk-btn tk-btn--glowny">
            Zbuduj set
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="konto__stan" role="status">
        Zapisane sety: {sets.length} z {SETS_MAX}.
      </p>
      {sets.length >= SETS_MAX ? (
        <InlineMessage variant="uwaga">
          Masz komplet {SETS_MAX} setów. Usuń któryś, żeby zapisać kolejny.
        </InlineMessage>
      ) : null}
      <ul className="lista konto-sety">
        {sets.map((s) => (
          <SetCard key={s.id} set={s} catalog={catalog} timeZone={timeZone} />
        ))}
      </ul>
    </div>
  );
}
