"use client";
// F-114, F-203 (docs/03 podsumowanie kreatora, docs/10 `set_save`; wzorzec: okno dialogowe szablonu, docs/08): przycisk
// "Zapisz set" w podsumowaniu kreatora. Dialog z polem nazwy (wspolny modul nakladek: pulapka fokusu, Esc, powrot
// fokusu), zapis do `taktyl.sets.v1` (maks. 10), toast "Set zapisany" i zdarzenie `set_save`. Zadnych okien systemowych.
import { Button, Dialog, Field, InlineMessage, useToast } from "@taktyl/ui";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { SET_NAME_MAX, SETS_MAX, savedSets } from "../../lib/account/sets";
import { track } from "../../lib/track";
import { grToZl } from "../../lib/track-items";

export interface SaveSetButtonProps {
  k: string | null;
  m: string | null;
  p: string | null;
  profile: string | null;
  handCm: number | null;
  /** Wartosc setu po rabacie w groszach (tylko do zdarzenia `set_save`). */
  totalGr: number;
  /** Domyslna nazwa w polu. */
  defaultName?: string;
}

export function SaveSetButton({
  k,
  m,
  p,
  profile,
  handCm,
  totalGr,
  defaultName = "Mój set",
}: SaveSetButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();
  const empty = !k && !m && !p;

  const close = () => setOpen(false);
  const openDialog = () => {
    setName(defaultName);
    setError(null);
    setLimit(false);
    setOpen(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = savedSets.save({ name, k, m, p, profile, handCm });
    if (res.ok) {
      close();
      toast({ message: "Set zapisany" });
      track("set_save", { value: grToZl(totalGr) });
      return;
    }
    if (res.reason === "limit") {
      setLimit(true);
      setError(null);
    } else if (res.reason === "name") {
      setError("Wpisz nazwę setu.");
    } else {
      setError("Wybierz przynajmniej jeden produkt, żeby zapisać set.");
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        disabled={empty}
        aria-haspopup="dialog"
        onClick={openDialog}
      >
        Zapisz set
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Zapisz set"
        returnFocusRef={triggerRef}
        closeLabel="Zamknij okno zapisu setu"
      >
        <form onSubmit={submit} className="konto-zapis" noValidate>
          <Field
            label="Nazwa setu"
            hint={`Do ${SET_NAME_MAX} znaków. Zapisane sety znajdziesz w koncie demo.`}
            value={name}
            maxLength={SET_NAME_MAX}
            autoComplete="off"
            error={error}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          {limit ? (
            <InlineMessage variant="uwaga">
              Masz już {SETS_MAX} zapisanych setów. Usuń któryś w{" "}
              <Link href="/konto/sety" className="tk-link">
                zapisanych setach
              </Link>
              , żeby zapisać kolejny.
            </InlineMessage>
          ) : null}
          <div className="konto-zapis__akcje">
            <Button type="submit" disabled={limit}>
              Zapisz
            </Button>
            <Button variant="secondary" onClick={close}>
              Anuluj
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
