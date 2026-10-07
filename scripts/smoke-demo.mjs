// I-009 (B-014, S32, TAKTYL-65): test dymny trybu demo. Uruchamiany WEWNATRZ kontenera api (patrz smoke-demo.sh), wiec nie
// wymaga lokalnego Node. Przechodzi sciezke "owner zmienia dane -> reset z backpanelu -> dane = seed":
// zmiana ceny przez API admina, zgloszenie z formularza, POST /v1/admin/demo/reset, sprawdzenie ze cena wrocila,
// zgloszenia znikly, sesja ownera przezyla reset, a wpis demo.reset jest w dzienniku.
const API = process.env.SMOKE_API_URL ?? "http://127.0.0.1:4000";
const SKU = "M-WRB-GRF";
const SLUG = "m-wrobel";
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? "ok:  " : "BLAD:"} ${msg}`);
  if (!cond) failed = true;
};

async function call(method, path, { body, session, ifMatch } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (session) {
    headers.Cookie = session.cookie;
    if (method !== "GET") headers["X-CSRF-Token"] = session.csrf;
  }
  if (ifMatch !== undefined) headers["If-Match"] = `"${ifMatch}"`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* odpowiedz bez JSON */
  }
  return { status: res.status, json, headers: res.headers };
}

const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
if (!email || !password) {
  console.error("BLAD: brak ADMIN_BOOTSTRAP_EMAIL/PASSWORD w srodowisku kontenera api");
  process.exit(1);
}

const login = await call("POST", "/v1/admin/auth/login", { body: { email, password } });
ok(login.status === 200, "owner loguje sie kontem startowym");
if (login.status !== 200) process.exit(1);
const session = {
  cookie: (login.headers.getSetCookie()[0] ?? "").split(";")[0],
  csrf: login.json.csrf_token,
};

const priceOf = async () => {
  const r = await call("GET", `/v1/admin/products/${SLUG}`, { session });
  const v = r.json?.variants?.find((x) => x.sku === SKU);
  return { price: v?.price_gr, version: v?.version, status: r.status };
};
const messages = async () => (await call("GET", "/v1/admin/messages", { session })).json?.total ?? -1;

const before = await priceOf();
ok(before.status === 200 && Number.isInteger(before.price), `odczyt ceny ${SKU}: ${before.price} gr`);
const seedPrice = before.price;

const changed = await call("PUT", `/v1/admin/variants/${SKU}/price`, {
  session,
  ifMatch: before.version,
  body: { price_gr: seedPrice + 7700, reason: "smoke-demo" },
});
ok(changed.status === 200, "owner zmienia cene przez API admina");
ok((await priceOf()).price === seedPrice + 7700, "cena zmieniona w katalogu");
const contact = await call("POST", "/v1/forms/contact", {
  body: { email: "smoke@taktyl.example", subject: "Test trybu demo", message: "Wiadomosc testowa." },
});
ok(contact.status === 201, "zgloszenie z formularza zapisane");
ok((await messages()) >= 1, "zgloszenie widoczne w backpanelu");

const noConfirm = await call("POST", "/v1/admin/demo/reset", { session, body: {} });
ok(noConfirm.status === 422, "reset bez potwierdzenia: 422");

const reset = await call("POST", "/v1/admin/demo/reset", { session, body: { confirm: "reset" } });
ok(reset.status === 200 && reset.json?.status === "reset", "reset z backpanelu (B-014): 200");

const after = await priceOf();
ok(after.price === seedPrice, `S32: cena wrocila do seeda (${after.price} gr)`);
ok((await messages()) === 0, "zgloszenia usuniete przez reset");
const list = await call("GET", "/v1/admin/products?per_page=100", { session });
ok(list.status === 200 && list.json?.total === 18, `18 produktow po resecie (${list.json?.total})`);
const me = await call("GET", "/v1/admin/auth/me", { session });
ok(me.status === 200, "sesja ownera przezyla reset");
const audit = await call("GET", "/v1/admin/audit?entity=demo", { session });
ok(
  audit.status === 200 &&
    audit.json?.items?.some((e) => e.action === "demo.reset" && e.actor_role === "owner"),
  "wpis demo.reset (owner) w dzienniku zmian",
);

process.exit(failed ? 1 : 0);
