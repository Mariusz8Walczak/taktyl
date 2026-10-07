// Audyt ruchu (TAKTYL-36, docs/07 §1): statyczna kontrola arkuszy CSS.
//  1. @keyframes animuja wylacznie transform, translate, scale, rotate, opacity, plynna zmiane koloru i kat --kat (@property).
//  2. transition / transition-property / will-change: tylko te same wlasciwosci (nigdy width, height, top, left, margin,
//     padding, font-size ani all).
//  3. Czasy tylko z tokenow (var(--d-*)): zadnych literalow "ms" / "s" w animation*, transition*.
//  4. Krzywe tylko z tokenow (var(--e-*)): zadnych slow ease / linear / steps() / cubic-bezier() w animation*, transition*.
// Skanuje: apps/*/src/**/*.css, packages/ui/css/**/*.css, packages/tokens/css/taktyl.css (nie tokens.css - tam sa definicje).
// Kod wyjscia 1 przy trafieniu. Uzycie: node scripts/audit-motion.mjs [katalog-glowny]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const SKIP_DIRS = new Set(["node_modules", "dist", ".next", ".turbo", "coverage", ".git"]);

/** Wlasciwosci dozwolone w ruchu (docs/07 §1): transform i opacity, kolory plynnie, kat pierscienia A-16; visibility tylko
 *  jako dopelnienie opacity (znikniecie z kolejnosci tabulatora po wygaszeniu, nie przelicza ukladu). */
export const ALLOWED = new Set([
  "transform",
  "translate",
  "scale",
  "rotate",
  "opacity",
  "visibility",
  "color",
  "background-color",
  "border-color",
  "outline-color",
  "text-decoration-color",
  "box-shadow",
  "--kat",
]);
const TIME_PROPS =
  /^(animation|animation-duration|animation-delay|transition|transition-duration|transition-delay)$/;
const EASING_PROPS =
  /^(animation|animation-timing-function|transition|transition-timing-function)$/;

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/** Prosty parser blokow CSS: zwraca drzewo { prelude, decls, children, line }. */
export function parseCss(css) {
  const src = stripComments(css);
  let i = 0;
  const lineAt = (idx) => src.slice(0, idx).split("\n").length;

  function parseBlock(untilBrace) {
    const node = { decls: [], children: [] };
    let buf = "";
    let bufStart = i;

    function flushDecl() {
      const text = buf.trim();
      buf = "";
      if (!text) return;
      const idx = text.indexOf(":");
      if (idx < 0) return;
      node.decls.push({
        prop: text.slice(0, idx).trim().toLowerCase(),
        value: text.slice(idx + 1).trim(),
        line: lineAt(bufStart),
      });
    }

    while (i < src.length) {
      const ch = src[i];
      if (ch === "(") {
        // nawiasy (url(), calc(), var()) nie przerywaja deklaracji
        let depth = 0;
        while (i < src.length) {
          if (src[i] === "(") depth++;
          if (src[i] === ")") {
            depth--;
            if (depth === 0) {
              buf += src[i++];
              break;
            }
          }
          buf += src[i++];
        }
        continue;
      }
      if (ch === '"' || ch === "'") {
        const q = ch;
        buf += src[i++];
        while (i < src.length && src[i] !== q) buf += src[i++];
        buf += src[i++] ?? "";
        continue;
      }
      if (ch === "{") {
        const prelude = buf.trim();
        const line = lineAt(bufStart + (buf.length - buf.trimStart().length));
        i++;
        const child = parseBlock(true);
        child.prelude = prelude;
        child.line = line;
        node.children.push(child);
        buf = "";
        bufStart = i;
        continue;
      }
      if (ch === "}") {
        i++;
        if (untilBrace) {
          flushDecl();
          return node;
        }
        buf = "";
        continue;
      }
      if (ch === ";") {
        flushDecl();
        i++;
        bufStart = i;
        continue;
      }
      buf += ch;
      i++;
    }
    flushDecl();
    return node;
  }
  return parseBlock(false);
}

/** Dzieli wartosc po separatorze poza nawiasami. */
function splitTop(value, separator = ",") {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    const isSep = separator === " " ? /\s/.test(ch) : ch === separator;
    if (isSep && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function withoutVars(value) {
  let v = value;
  let prev;
  do {
    prev = v;
    v = v.replace(/var\([^()]*\)/g, " ");
  } while (v !== prev);
  return v;
}

const TIME_LITERAL = /(?<![\w.-])-?\d*\.?\d+m?s\b/;
const EASING_LITERAL =
  /\b(cubic-bezier|steps)\(|(?<![\w-])(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)(?![\w-])/;

function checkTimingAndEasing(d, file, hits) {
  const where = `${file}:${d.line}`;
  const v = withoutVars(d.value);
  if (TIME_PROPS.test(d.prop) && TIME_LITERAL.test(v)) {
    hits.push(`${where}: czas wpisany wprost w "${d.prop}: ${d.value}" (uzyj var(--d-*))`);
  }
  if (EASING_PROPS.test(d.prop) && EASING_LITERAL.test(v)) {
    hits.push(`${where}: krzywa wpisana wprost w "${d.prop}: ${d.value}" (uzyj var(--e-*))`);
  }
}

function checkProperty(prop, d, file, hits, ctx) {
  if (["none", "auto", "initial", "inherit", "unset", ""].includes(prop)) return;
  if (!ALLOWED.has(prop)) {
    hits.push(
      `${file}:${d.line}: ${ctx} animuje "${prop}" (dozwolone: ${[...ALLOWED].join(", ")})`,
    );
  }
}

export function auditCss(css, file) {
  const hits = [];
  const tree = parseCss(css);
  (function walk(node, inKeyframes) {
    for (const d of node.decls) {
      if (inKeyframes) {
        if (d.prop === "animation-timing-function") checkTimingAndEasing(d, file, hits);
        else if (!d.prop.startsWith("animation") && !d.prop.startsWith("transition")) {
          checkProperty(d.prop, d, file, hits, "@keyframes");
        }
        continue;
      }
      if (d.prop === "transition-property") {
        for (const p of splitTop(d.value))
          checkProperty(p.toLowerCase(), d, file, hits, "transition");
      } else if (d.prop === "transition") {
        for (const seg of splitTop(d.value)) {
          const tok = splitTop(seg, " ")[0]?.toLowerCase() ?? "";
          if (tok.startsWith("var(") || /^[\d.-]/.test(tok)) continue; // zmienna albo czas na poczatku: brak nazwy
          checkProperty(tok, d, file, hits, "transition");
        }
      } else if (d.prop === "will-change") {
        for (const p of splitTop(d.value))
          checkProperty(p.toLowerCase(), d, file, hits, "will-change");
      }
      if (TIME_PROPS.test(d.prop) || EASING_PROPS.test(d.prop)) checkTimingAndEasing(d, file, hits);
    }
    for (const c of node.children) {
      if (/^@(-webkit-)?keyframes\b/i.test(c.prelude ?? "")) {
        for (const frame of c.children) walk(frame, true);
      } else {
        walk(c, inKeyframes);
      }
    }
  })(tree, false);
  return hits;
}

function listCss(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === "ENOENT") return out;
    throw e;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) listCss(join(dir, e.name), out);
    } else if (/\.css$/i.test(e.name)) out.push(join(dir, e.name));
  }
  return out;
}

export function collectFiles(base) {
  const files = [];
  try {
    for (const app of readdirSync(join(base, "apps"))) {
      if (statSync(join(base, "apps", app)).isDirectory()) {
        listCss(join(base, "apps", app, "src"), files);
      }
    }
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  listCss(join(base, "packages", "ui", "css"), files);
  const taktyl = join(base, "packages", "tokens", "css", "taktyl.css");
  try {
    statSync(taktyl);
    files.push(taktyl);
  } catch {
    /* brak pliku */
  }
  return files;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const hits = [];
  const files = collectFiles(root);
  for (const f of files) {
    const rel = relative(root, f).split(sep).join("/");
    hits.push(...auditCss(readFileSync(f, "utf8"), rel));
  }
  if (hits.length) {
    console.error(`audit:motion - ${hits.length} trafien (docs/07 §1):`);
    for (const h of hits) console.error("  " + h);
    process.exit(1);
  }
  console.log(`audit:motion - 0 trafien (${files.length} arkuszy)`);
}
