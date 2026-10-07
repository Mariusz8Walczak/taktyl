"use client";
// F-200 (docs/02 §1.2, regula 10): "sesja demo" to flaga w przegladarce. Zadnych hasel, kont ani danych osobowych:
// przycisk "Zaloguj jako uzytkownika demo" zapisuje flage pod osobnym kluczem (docs/decyzje.md WEB-156); dane konta
// (zamowienia, sety, ulubione) i tak leza w localStorage tej przegladarki.
import { useSyncExternalStore } from "react";
import { createPersistedStore } from "./persisted-store";

export const DEMO_SESSION_KEY = "taktyl.demo.v1";
interface DemoSession {
  v: 1;
  demo: boolean;
}
const OFF: DemoSession = { v: 1, demo: false };
const ON: DemoSession = { v: 1, demo: true };

export const demoSessionStore = createPersistedStore<DemoSession>(
  DEMO_SESSION_KEY,
  (raw) => ((raw as { demo?: unknown } | null)?.demo === true ? ON : OFF),
  OFF,
);

export const demoSession = {
  login: () => demoSessionStore.set(ON),
  logout: () => demoSessionStore.set(OFF),
};

export function useDemoSession(): boolean {
  return useSyncExternalStore(
    demoSessionStore.subscribe,
    () => demoSessionStore.get().demo,
    () => false,
  );
}
