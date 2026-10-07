"use client";
// F-243 (TAKTYL-60): montaz panelu podgladu zdarzen w OSOBNYM korzeniu React (document.body), poza drzewem sklepu:
// nie zmienia hydracji ani ukladu. Ten modul (razem z panelem i stylami) laduje sie dynamicznym importem wylacznie
// przy `?pomiar` - patrz loader.ts.
import { createRoot } from "react-dom/client";
import "../../styles/panel-pomiaru.css";
import { TrackingPanel } from "./tracking-panel";

export const PANEL_ROOT_ID = "panel-pomiaru-korzen";

/** Zwraca funkcje demontujaca. Drugie wywolanie nie tworzy drugiego panelu. */
export function mountTrackingPanel(): () => void {
  if (document.getElementById(PANEL_ROOT_ID)) return () => {};
  const host = document.createElement("div");
  host.id = PANEL_ROOT_ID;
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(<TrackingPanel />);
  return () => {
    root.unmount();
    host.remove();
  };
}
