"use client";
// F-223: najmniejszy mozliwy most do leniwego ladowania logiki newslettera (bez renderu). Stopka jest w kazdej stronie,
// wiec ten kod liczy sie do budzetu JS kazdej z nich (docs/12 §4): zostaje jedno nasluchiwanie `focusin`, a cala logika
// (walidacja, wysylka, generate_lead) jest osobnym chunkiem dociaganym przy pierwszym fokusie w formularzu.
import { useEffect } from "react";

export function NewsletterEnhancer({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    const start = () =>
      void import("../../lib/forms/newsletter-enhance").then((m) => m.enhanceNewsletter(form!));
    form?.addEventListener("focusin", start, { once: true });
    return () => form?.removeEventListener("focusin", start);
  }, [formId]);
  return null;
}
