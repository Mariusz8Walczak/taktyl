// I-014 (docs/24): smoke serwerow MCP na prawdziwym stosie (Docker). Uruchamia zbudowane serwery przez klienta SDK:
//   front (stdio i HTTP): lista narzedzi bez zapisujacych, wyszukiwanie, produkt, wycena koszyka, brak uwierzytelniania;
//   admin (stdio): logowanie, confirm dla kasowania, zmiana ceny -> dziennik zmian i widok publiczny, przywrocenie ceny,
//   a na koncu reset danych demo (stos testowy z DEMO_MODE=true).
// Zmienne: TAKTYL_API_URL (np. http://api:4000), TAKTYL_ADMIN_EMAIL, TAKTYL_ADMIN_PASSWORD. Uruchomienie: `make smoke-mcp`.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { setTimeout as sleep } from "node:timers/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const api = process.env.TAKTYL_API_URL ?? "http://api:4000";
const email = process.env.TAKTYL_ADMIN_EMAIL;
const password = process.env.TAKTYL_ADMIN_PASSWORD;
if (!email || !password) {
  console.error("smoke-mcp: ustaw TAKTYL_ADMIN_EMAIL i TAKTYL_ADMIN_PASSWORD");
  process.exit(2);
}
const dist = (app) => fileURLToPath(new URL(`../../../apps/${app}/dist/main.js`, import.meta.url));

let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures += 1;
};
const text = (r) => r.content?.[0]?.text ?? "";
const json = (r) => JSON.parse(text(r));

async function stdioClient(app, env) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [dist(app)],
    env: { TAKTYL_API_URL: api, ...env },
    stderr: "ignore",
  });
  const client = new Client({ name: "smoke", version: "0" });
  await client.connect(transport);
  return client;
}

// ---- front office, stdio ----
const front = await stdioClient("mcp-front", {});
const frontTools = (await front.listTools()).tools;
const names = frontTools.map((t) => t.name);
ok(
  frontTools.every((t) => t.annotations?.readOnlyHint === true),
  `front: ${names.length} narzedzi, wszystkie tylko do odczytu`,
);
ok(
  !names.includes("create_order") && !names.includes("simulate_payment"),
  "front: brak narzedzi zapisujacych (ALLOW_ORDERS wylaczone)",
);
const found = json(await front.callTool({ name: "search_catalog", arguments: { q: "bazalt" } }));
ok(
  found.products?.some((p) => p.slug === "bazalt-75"),
  "front: search_catalog znajduje Bazalt 75",
);
ok(typeof found.products?.[0]?.thumb !== "undefined", "front: wynik wyszukiwania ma pole thumb");
const product = json(
  await front.callTool({ name: "get_product", arguments: { slug: "bazalt-75" } }),
);
const variant = product.variants?.[0];
ok(Boolean(variant?.sku), "front: get_product zwraca warianty z SKU");
const quote = json(
  await front.callTool({
    name: "quote_cart",
    arguments: { items: [{ type: "item", sku: variant.sku, qty: 1 }] },
  }),
);
ok(
  quote.summary?.products_gr === variant.price_gr,
  "front: quote_cart liczy cene po stronie serwera",
);
// odpowiedzi wszystkich narzedzi odczytu przechodza kontrakty z @taktyl/contracts na prawdziwych danych
const guides = json(await front.callTool({ name: "list_guides", arguments: {} }));
const guideSlug = (guides.items ?? guides)?.[0]?.slug;
const readCalls = [
  ["list_categories", {}],
  ["list_products", { category: "klawiatury", limit: 6 }],
  ["list_products", { category: "myszki", filters: { dostepnosc: "1" }, sort: "cena-rosnaco" }],
  ["get_facets", { category: "podkladki" }],
  ["get_complete_set", { slug: "bazalt-75" }],
  ["get_product_reviews", { slug: "bazalt-75" }],
  ["list_switches", {}],
  ["list_colors", {}],
  ["get_rules", {}],
  ["list_presets", {}],
  ["get_shop_settings", {}],
  ["get_shipping_estimate", { method: "kurier" }],
  ["list_pickup_points", {}],
  ["list_guides", {}],
  ["get_faq", {}],
  ...(guideSlug ? [["get_guide", { slug: guideSlug }]] : []),
];
for (const [name, args] of readCalls) {
  const r = await front.callTool({ name, arguments: args });
  ok(
    r.isError !== true,
    `front: ${name} zgodne z kontraktem${r.isError ? ` (${text(r).slice(0, 120)})` : ""}`,
  );
}
await front.close();

// ---- front office, HTTP klasy open ----
const port = 3399;
const httpProc = spawn(process.execPath, [dist("mcp-front")], {
  env: {
    PATH: process.env.PATH,
    TAKTYL_API_URL: api,
    TAKTYL_MCP_TRANSPORT: "http",
    TAKTYL_MCP_HTTP_PORT: String(port),
    TAKTYL_MCP_HTTP_HOST: "127.0.0.1",
  },
  stdio: "ignore",
});
try {
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 40; i += 1) {
    if ((await fetch(`${base}/health`).catch(() => null))?.ok) break;
    await sleep(250);
  }
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  const rpc = async (id, method, params) =>
    (
      await fetch(`${base}/mcp`, {
        method: "POST",
        headers,
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      })
    ).json();
  await rpc(1, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0" },
  });
  const list = await rpc(2, "tools/list", {});
  ok(
    list.result?.tools?.length === names.length,
    "front HTTP: ta sama lista narzedzi, bez klucza i bez logowania",
  );
  const call = await rpc(3, "tools/call", { name: "list_categories", arguments: {} });
  ok(call.result?.isError !== true, "front HTTP: list_categories dziala");
  ok((await fetch(`${base}/mcp`)).status === 405, "front HTTP: GET /mcp = 405 (bezstanowy)");
} finally {
  httpProc.kill();
}

// ---- backoffice, stdio ----
const admin = await stdioClient("mcp-admin", {
  TAKTYL_ADMIN_EMAIL: email,
  TAKTYL_ADMIN_PASSWORD: password,
});
try {
  const me = json(await admin.callTool({ name: "whoami", arguments: {} }));
  ok(me.user?.role === "owner", "admin: zalogowano jako owner");
  const refused = await admin.callTool({
    name: "delete_product",
    arguments: { id: "k-bazalt-75" },
  });
  ok(refused.isError === true, "admin: delete_product bez confirm odrzucone");
  const stillThere = json(
    await admin.callTool({ name: "get_product", arguments: { id: "k-bazalt-75" } }),
  );
  ok(stillThere.id === "k-bazalt-75", "admin: produkt nietkniety po odmowie");

  const v = stillThere.variants[0];
  const newPrice = v.price_gr + 100;
  const set = await admin.callTool({
    name: "set_price",
    arguments: { sku: v.sku, price: { price_gr: newPrice, reason: "smoke MCP" } },
  });
  ok(!set.isError, `admin: set_price ${v.sku} ${v.price_gr} -> ${newPrice}`);
  const audit = json(
    await admin.callTool({ name: "list_audit", arguments: { entity_id: v.sku, per_page: 5 } }),
  );
  ok(
    audit.items?.some((e) => e.action === "variant.price.set"),
    "admin: zmiana ceny jest w dzienniku zmian (variant.price.set)",
  );

  let visible = false;
  const front2 = await stdioClient("mcp-front", {});
  for (let i = 0; i < 20 && !visible; i += 1) {
    const p = json(
      await front2.callTool({ name: "get_product", arguments: { slug: "bazalt-75" } }),
    );
    visible = p.variants.find((x) => x.sku === v.sku)?.price_gr === newPrice;
    if (!visible) await sleep(500);
  }
  ok(visible, "propagacja: nowa cena widoczna w front office w <= 10 s");
  await front2.close();

  const back = await admin.callTool({
    name: "set_price",
    arguments: { sku: v.sku, price: { price_gr: v.price_gr, reason: "smoke MCP: przywrocenie" } },
  });
  ok(!back.isError, "admin: cena przywrocona");

  const noConfirm = await admin.callTool({ name: "reset_demo", arguments: {} });
  ok(noConfirm.isError === true, "admin: reset_demo bez confirm odrzucony");
  const reset = await admin.callTool({ name: "reset_demo", arguments: { confirm: true } });
  ok(!reset.isError, "admin: reset_demo z confirm przywraca dane demo");

  const leaked = [password].some((s) => [text(me), text(set), text(reset)].join("").includes(s));
  ok(!leaked, "admin: haslo nie wystepuje w zadnej odpowiedzi narzedzia");
} finally {
  await admin.close();
}

console.log(failures === 0 ? "\nsmoke-mcp: OK" : `\nsmoke-mcp: ${failures} bledow`);
process.exit(failures === 0 ? 0 : 1);
