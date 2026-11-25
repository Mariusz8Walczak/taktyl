"use client";
// B-627 (docs/25 par. 3): motyw backpanelu. Ciemny = drugi zestaw tych samych tokenow ([data-motyw="ciemny"] w tokens.css),
// zapisany w localStorage (wygoda jednej przegladarki; brak dostepu do pamieci = motyw z ustawien systemu).
import { useCallback, useEffect, useState } from "react";
import { THEME_KEY } from "./theme-boot";

export type Theme = "jasny" | "ciemny";
function current(): Theme {
  if (typeof document === "undefined") return "jasny";
  return document.documentElement.getAttribute("data-motyw") === "ciemny" ? "ciemny" : "jasny";
}

export function applyTheme(theme: Theme): void {
  if (theme === "ciemny") document.documentElement.setAttribute("data-motyw", "ciemny");
  else document.documentElement.removeAttribute("data-motyw");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // brak pamieci przegladarki: motyw dziala do przeladowania
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("jasny");
  useEffect(() => setTheme(current()), []);
  const toggle = useCallback(() => {
    const next: Theme = current() === "ciemny" ? "jasny" : "ciemny";
    applyTheme(next);
    setTheme(next);
  }, []);
  return { theme, toggle };
}
