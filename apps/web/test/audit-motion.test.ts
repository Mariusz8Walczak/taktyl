// TAKTYL-36: skrypt scripts/audit-motion.mjs (docs/07 §1) - wykrywa ruch spoza dozwolonych wlasciwosci, czasy i krzywe
// wpisane wprost; przepuszcza ruch z tokenow. Uruchamiany jako proces na tymczasowym drzewie plikow.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = join(__dirname, "..", "..", "..", "scripts", "audit-motion.mjs");
let dir = "";
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function run(css: string) {
  dir = mkdtempSync(join(tmpdir(), "audit-motion-"));
  mkdirSync(join(dir, "packages", "ui", "css"), { recursive: true });
  writeFileSync(join(dir, "packages", "ui", "css", "test.css"), css);
  const r = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe("audit:motion", () => {
  it("przepuszcza ruch z tokenow: transform, opacity, kolor, @property", () => {
    const r = run(`
      .a { transition: transform var(--d-klik) var(--e-wyjscie), background-color var(--d-s) var(--e-wyjscie); will-change: transform, opacity; }
      .b { animation: x calc(var(--d-scena) * 0.46) var(--e-osadzenie) calc(var(--d-scena) / 8) both; }
      @media (prefers-reduced-motion: reduce) { .a { animation: none; transition: none; will-change: auto; } }
      @keyframes x { from { opacity: 0; transform: translateY(4px); } 50% { scale: 1.2; } to { --kat: 360deg; } }
    `);
    expect(r.out).toContain("0 trafien");
    expect(r.code).toBe(0);
  });

  it.each([
    [
      "@keyframes animuje width",
      "@keyframes x { from { width: 0; } to { width: 100%; } }",
      "width",
    ],
    ["@keyframes animuje margin", "@keyframes x { to { margin-left: 4px; } }", "margin-left"],
    ["@keyframes animuje top", "@keyframes x { to { top: 4px; } }", "top"],
    ["transition: all", ".a { transition: all var(--d-s) var(--e-wyjscie); }", "all"],
    [
      "transition font-size",
      ".a { transition: font-size var(--d-s) var(--e-wyjscie); }",
      "font-size",
    ],
    ["transition-property height", ".a { transition-property: height; }", "height"],
    ["will-change: width", ".a { will-change: width; }", "width"],
    [
      "czas wpisany wprost (transition)",
      ".a { transition: opacity 200ms var(--e-wyjscie); }",
      "czas wpisany",
    ],
    [
      "czas wpisany wprost (animation)",
      ".a { animation: x 0.3s var(--e-wyjscie); }",
      "czas wpisany",
    ],
    ["animation-delay wprost", ".a { animation-delay: 120ms; }", "czas wpisany"],
    ["krzywa wpisana wprost", ".a { transition: opacity var(--d-s) ease-in-out; }", "krzywa"],
    ["cubic-bezier wprost", ".a { animation: x var(--d-s) cubic-bezier(.1,.2,.3,1); }", "krzywa"],
    [
      "czas w calc z literalem",
      ".a { animation-duration: calc(var(--d-s) + 20ms); }",
      "czas wpisany",
    ],
  ])("wykrywa: %s", (_n, css, fragment) => {
    const r = run(css);
    expect(r.code).toBe(1);
    expect(r.out).toContain(fragment);
  });

  it("nie myli linear-gradient z krzywa liniowa", () => {
    const r = run(
      `.a { background: linear-gradient(90deg, transparent, var(--akcent)); animation: x var(--d-l) var(--e-wyjscie); }`,
    );
    expect(r.code).toBe(0);
  });
});
