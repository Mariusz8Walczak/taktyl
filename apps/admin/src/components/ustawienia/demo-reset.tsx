"use client";
// B-014 (docs/15 par. 6), I-009 (TAKTYL-65): reset danych demo z backpanelu. Widoczny tylko przy DEMO_MODE=true i roli owner;
// potwierdzenie w tresci strony (wpisanie slowa "reset", bez window.confirm). Po resecie dane = seed, sklep odswieza sie sam (outbox).
import { demoResetResponseSchema } from "@taktyl/contracts";
import { Alert, Button, Field } from "@taktyl/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, apiRequest } from "../../lib/api/client";
import { useAuth } from "../../lib/auth/session";
import { formatTime } from "../../lib/format";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "ok"; at: Date } | { kind: "error"; text: string };

export function DemoResetPanel({ demoMode }: { demoMode: boolean }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [word, setWord] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  if (!demoMode || session?.user.role !== "owner") return null;

  const confirmed = word.trim().toLowerCase() === "reset";
  const run = async () => {
    setState({ kind: "busy" });
    try {
      const r = await apiRequest({
        method: "POST",
        path: "/v1/admin/demo/reset",
        body: { confirm: "reset" },
        schema: demoResetResponseSchema,
      });
      setWord("");
      await qc.invalidateQueries();
      setState({ kind: "ok", at: new Date(r.data.at) });
    } catch (e) {
      const limited = e instanceof ApiError && e.status === 429;
      setState({
        kind: "error",
        text: limited
          ? "Za dużo prób. Spróbuj za minutę."
          : "Nie udało się zresetować danych demo. Spróbuj ponownie.",
      });
    }
  };

  return (
    <section className="adm-karta adm-stos" aria-labelledby="demo-reset-tytul">
      <h2 id="demo-reset-tytul">Dane demo</h2>
      <p>
        Reset przywraca produkty, ceny, stany, treści i ustawienia do stanu początkowego oraz usuwa
        zamówienia i zgłoszenia. Konta backpanelu i zdjęcia zostają. Sklep odświeży się w kilka sekund.
      </p>
      <Field
        label="Wpisz „reset”, aby potwierdzić"
        value={word}
        autoComplete="off"
        onChange={(e) => setWord(e.target.value)}
      />
      <div>
        <Button
          variant="secondary"
          disabled={!confirmed}
          loading={state.kind === "busy"}
          onClick={() => void run()}
          aria-describedby={confirmed ? undefined : "demo-reset-powod"}
        >
          Zresetuj dane demo
        </Button>
        {confirmed ? null : (
          <p id="demo-reset-powod" className="adm-powod">
            Przycisk jest nieaktywny, dopóki nie wpiszesz słowa „reset”.
          </p>
        )}
      </div>
      {state.kind === "ok" ? (
        <Alert variant="sukces">Dane demo przywrócone o {formatTime(state.at)}.</Alert>
      ) : null}
      {state.kind === "error" ? <Alert variant="blad">{state.text}</Alert> : null}
    </section>
  );
}
