// I-010 (TAKTYL-44, TAKTYL-66): audyt systemu designu ze skryptu z docs/12 par. 3, uruchamiany na zywej stronie.
import { expect, type Page } from "@playwright/test";

export type DesignAudit = {
  rozmiarow: number;
  rodzin: number;
  wariantow_przycisku_glownego: number;
  promieni: string[];
  male_cele: string[];
  zdublowane_id: string[];
};

/**
 * Skrypt z docs/12 par. 3 z trzema udokumentowanymi dopasowaniami do naszego kodu (TAKTYL-66, docs/decyzje.md):
 *  1. klasa przycisku glownego to .tk-btn--glowny (w docs/12: .btn-glowny z szablonu), pobocznego .tk-btn--poboczny;
 *     warianty liczone osobno w kontekscie jasnym i w .sekcja--mod (ten sam komponent, przelaczony zestaw tokenow), bez stanu nieaktywnego;
 *  2. rozmiar czcionki nie liczy tekstu w .tk-scena (podpisy skalowane transform: efektywny rozmiar = token, scena.css);
 *  3. cel dotykowy to: dla pola wyboru/radio - jego etykieta (label), dla odnosnika z rozciagnietym ::after (karta) -
 *     najblizszy przodek pozycjonowany; odnosniki w ciaglym tekscie (w p/li/dd z innym tekstem) sa wyjatkiem z docs/12.
 */
const SCRIPT = `(() => {
const vis = [...document.querySelectorAll('*')].filter(e => e.offsetParent);
const fs = {}; vis.forEach(e => { const s = getComputedStyle(e);
  if (e.textContent && !e.children.length && e.textContent.trim() && !e.closest('.tk-scena')) fs[s.fontSize] = (fs[s.fontSize]||0)+1; });
const btns = [...document.querySelectorAll('.tk-btn--glowny:not(:disabled):not([aria-disabled="true"])')].filter(e => e.offsetParent);
const w = new Set(), r = new Set();
[...document.querySelectorAll('button, a.tk-btn--glowny, a.tk-btn--poboczny')].filter(e => e.offsetParent)
  .forEach(b => r.add(getComputedStyle(b).borderRadius));
const ctx = {};
btns.forEach(b => { const s = getComputedStyle(b); const c = b.closest('.sekcja--mod') ? 'mod' : 'alfa'; (ctx[c] ||= new Set()).add(s.backgroundColor + '/' + s.color); });
const wariantow = Math.max(0, ...Object.values(ctx).map(x => x.size));
const target = e => {
  if (e.matches('input[type=checkbox],input[type=radio]')) { const l = (e.labels && e.labels[0]) || e.closest('label'); if (l) return l.getBoundingClientRect(); }
  if (e.tagName === 'A') {
    const af = getComputedStyle(e, '::after');
    if (af.position === 'absolute' && af.top === '0px' && af.left === '0px') {
      let p = e.parentElement; while (p && getComputedStyle(p).position === 'static') p = p.parentElement;
      if (p) return p.getBoundingClientRect();
    }
  }
  return e.getBoundingClientRect();
};
const inlineText = e => { if (e.tagName !== 'A') return false; const p = e.closest('p,li,dd'); return !!p && p !== e && p.textContent.trim().length > e.textContent.trim().length + 3; };
return JSON.stringify({
  rozmiarow: Object.keys(fs).length,
  rodzin: new Set(vis.slice(0, 600).map(e => getComputedStyle(e).fontFamily.split(',')[0])).size,
  wariantow_przycisku_glownego: wariantow, promieni: [...r],
  male_cele: [...document.querySelectorAll('a,button,input,select,textarea,[role=button]')].filter(e => {
    const b = target(e); return e.offsetParent && b.width > 0 && !inlineText(e) && (b.width < 44 || b.height < 44); })
    .map(e => e.outerHTML.slice(0, 80)),
  zdublowane_id: [...document.querySelectorAll('[id]')].map(e => e.id).filter((v, i, a) => a.indexOf(v) !== i)
}, null, 1);
})()`;

export async function runDesignAudit(page: Page): Promise<DesignAudit> {
  const json = (await page.evaluate(SCRIPT)) as string;
  return JSON.parse(json) as DesignAudit;
}

/** Limity z docs/12 par. 3 i docs/06 par. 6 (0px dozwolone dla przyciskow bez tla, np. ikon). */
export function assertDesignAudit(audit: DesignAudit): void {
  expect.soft(audit.rozmiarow, "rozmiary czcionki").toBeLessThanOrEqual(7);
  expect.soft(audit.rodzin, "rodziny czcionki").toBe(1);
  expect
    .soft(audit.wariantow_przycisku_glownego, "warianty przycisku glownego")
    .toBeLessThanOrEqual(1);
  expect
    .soft(
      audit.promieni.filter((r) => !["10px", "999px", "0px"].includes(r)),
      "promienie spoza 10px/999px/0px",
    )
    .toEqual([]);
  expect.soft(audit.male_cele, "cele dotykowe < 44 px").toEqual([]);
  expect.soft(audit.zdublowane_id, "zdublowane id").toEqual([]);
}
