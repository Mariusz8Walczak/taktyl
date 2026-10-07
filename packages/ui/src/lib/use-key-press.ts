import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

/** Czas trwania klasy is-wcisniety (docs/07 §3.1; odpowiada --d-klik = 90 ms). */
export const KLIK_MS = 90;

/**
 * A-01 / A-17: Enter i Spacja nie wyzwalaja :active, wiec na czas jednego "kliknięcia"
 * dodajemy klase is-wcisniety. Zwraca flage i handler onKeyDown do podpiecia.
 */
export function useKeyPress(disabled = false) {
  const [pressed, setPressed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (disabled || e.repeat || (e.key !== "Enter" && e.key !== " ")) return;
      setPressed(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setPressed(false), KLIK_MS);
    },
    [disabled],
  );

  return { pressed, onKeyDown };
}
