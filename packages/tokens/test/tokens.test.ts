// TAKTYL-9: zgodnosc kopii z zrodlem prawdy (assets/) i test negatywny audytu (regula 2).
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const pkg = join(repo, "packages", "tokens");
const run = (script: string, ...args: string[]) =>
  spawnSync(process.execPath, [join(repo, "scripts", script), ...args], { encoding: "utf8" });

describe("zgodnosc z assets/", () => {
  it("tokens.css w pakiecie jest identyczny z assets/tokens.css", () => {
    const a = readFileSync(join(pkg, "css", "tokens.css"));
    expect(a.equals(readFileSync(join(repo, "assets", "tokens.css")))).toBe(true);
  });
  it("sync-tokens --check konczy sie kodem 0 (css, font, OFL.txt)", () => {
    expect(run("sync-tokens.mjs", "--check").status).toBe(0);
  });
  it("font i licencja sa dostepne z pakietu", () => {
    expect(readFileSync(join(pkg, "assets", "fonts", "OFL.txt"), "utf8")).toContain("SIL OPEN FONT LICENSE");
    const font = readFileSync(join(pkg, "assets", "fonts", "archivo-pl-400-700-w100-125.woff2"));
    expect(font.length).toBeGreaterThan(1000);
  });
  it("taktyl.css zawiera reset, [hidden] i fieldset", () => {
    const css = readFileSync(join(pkg, "css", "taktyl.css"), "utf8");
    expect(css).toContain("[hidden]{ display:none !important; }");
    expect(css).toContain("fieldset{ min-width:0; }");
    expect(css).toContain("font-family:var(--font)");
  });
});

describe("audit-tokens", () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));
  const fixture = (rel: string, content: string) => {
    const d = mkdtempSync(join(tmpdir(), "audit-"));
    dirs.push(d);
    mkdirSync(dirname(join(d, rel)), { recursive: true });
    writeFileSync(join(d, rel), content);
    return d;
  };
  // skladane w locie, by sam plik testu nie zawieral trafien
  const hex = "#" + "12ab34";
  const fn = "rg" + "b(";

  it("repo ma 0 trafien", () => {
    expect(run("audit-tokens.mjs").status).toBe(0);
  });
  it("negatywny: kolor hex w apps/** daje kod 1", () => {
    const r = run("audit-tokens.mjs", fixture("apps/web/a.css", `a{color:${hex}}`));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("apps/web/a.css:1");
  });
  it("negatywny: funkcja rgb w packages/** daje kod 1", () => {
    const r = run("audit-tokens.mjs", fixture("packages/x/b.tsx", `const c = "${fn}0,0,0)";`));
    expect(r.status).toBe(1);
  });
  it("plik tokenow i node_modules sa pomijane", () => {
    const d = fixture("packages/tokens/css/tokens.css", `:root{--a:${hex}}`);
    mkdirSync(join(d, "apps/web/node_modules/p"), { recursive: true });
    writeFileSync(join(d, "apps/web/node_modules/p/i.css"), `a{color:${hex}}`);
    expect(run("audit-tokens.mjs", d).status).toBe(0);
  });
  it("encja HTML &#106; nie jest trafieniem, a kolor hex w apps/** nadal tak (I-007)", () => {
    const entity = "&#" + "106;avascript";
    expect(run("audit-tokens.mjs", fixture("apps/api/e.ts", `const s = '${entity}';`)).status).toBe(0);
    expect(run("audit-tokens.mjs", fixture("apps/web/f.css", `a{color:#${"fff"}}`)).status).toBe(1);
  });
});
