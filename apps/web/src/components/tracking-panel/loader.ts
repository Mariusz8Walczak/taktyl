// F-243 (TAKTYL-60, docs/12 §4): panel podgladu zdarzen ma kosztowac 0 B JS bez parametru. Tu jest caly koszt strony
// bez `?pomiar`: jedno sprawdzenie adresu; kod panelu, style i jego korzen React to dynamiczny import, ktory
// zadziala TYLKO przy parametrze (nie jest w HTML-u jako <script>, wiec nie wchodzi do budzetu mierzonego).
export const POMIAR_PARAM = "pomiar";

export function trackingPanelRequested(search: string = window.location.search): boolean {
  try {
    return new URLSearchParams(search).has(POMIAR_PARAM);
  } catch {
    return false;
  }
}

/** Zwraca true, gdy panel zostal zamontowany (parametr jest w adresie). */
export async function maybeLoadTrackingPanel(): Promise<boolean> {
  if (!trackingPanelRequested()) return false;
  const { mountTrackingPanel } = await import("./mount");
  mountTrackingPanel();
  return true;
}
