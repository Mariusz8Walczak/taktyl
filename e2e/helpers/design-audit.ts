// I-010 (TAKTYL-44): audyt systemu designu ze skryptu z docs/12 par. 3, uruchamiany na zywej stronie (zadanie TAKTYL-68).
import type { Page } from "@playwright/test";

export type DesignAudit = {
  rozmiarow: number;
  rodzin: number;
  wariantow_przycisku_glownego: number;
  promieni: string[];
  male_cele: string[];
  zdublowane_id: string[];
};

/** Skrypt skopiowany 1:1 z docs/12 par. 3 (zwraca JSON jako tekst). */
const SCRIPT = `(() => {
const vis = [...document.querySelectorAll('*')].filter(e => e.offsetParent);
const fs = {}; vis.forEach(e => { const s = getComputedStyle(e);
  if (e.textContent && !e.children.length && e.textContent.trim()) fs[s.fontSize] = (fs[s.fontSize]||0)+1; });
const btns = [...document.querySelectorAll('.btn-glowny')].filter(e => e.offsetParent);
const w = new Set(), r = new Set();
[...document.querySelectorAll('button, a.btn-glowny, a.btn-poboczny')].filter(e => e.offsetParent)
  .forEach(b => r.add(getComputedStyle(b).borderRadius));
btns.forEach(b => { const s = getComputedStyle(b); w.add(s.backgroundColor + '/' + s.color); });
return JSON.stringify({
  rozmiarow: Object.keys(fs).length,
  rodzin: new Set(vis.slice(0, 600).map(e => getComputedStyle(e).fontFamily.split(',')[0])).size,
  wariantow_przycisku_glownego: w.size, promieni: [...r],
  male_cele: [...document.querySelectorAll('a,button,input,select,textarea,[role=button]')].filter(e => {
    const b = e.getBoundingClientRect(); return e.offsetParent && b.width > 0 && (b.width < 44 || b.height < 44); })
    .map(e => e.outerHTML.slice(0, 80)),
  zdublowane_id: [...document.querySelectorAll('[id]')].map(e => e.id).filter((v, i, a) => a.indexOf(v) !== i)
}, null, 1);
})()`;

export async function runDesignAudit(page: Page): Promise<DesignAudit> {
  const json = (await page.evaluate(SCRIPT)) as string;
  return JSON.parse(json) as DesignAudit;
}
