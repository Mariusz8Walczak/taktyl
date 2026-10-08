// I-011 (S30, TAKTYL-71): zmiana ceny Wrobla przez API admina (owner), uruchamiana WEWNATRZ kontenera api (patrz smoke-outbox.sh),
// gdy sklep (`web`) jest zatrzymany. Wypisuje `PRICE_GR=<nowa cena>`. Zdarzenie outbox powstaje w tej samej transakcji co cena.
const API = process.env.SMOKE_API_URL ?? "http://127.0.0.1:4000";
const SKU = "M-WRB-GRF";
const SLUG = "m-wrobel";
const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
if (!email || !password) {
  console.error("BLAD: brak ADMIN_BOOTSTRAP_EMAIL/PASSWORD w srodowisku kontenera api");
  process.exit(1);
}
const call = async (method, path, { body, session, ifMatch } = {}) => {
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
  return { status: res.status, json: text ? JSON.parse(text) : null, headers: res.headers };
};
const login = await call("POST", "/v1/admin/auth/login", { body: { email, password } });
if (login.status !== 200) {
  console.error(`BLAD: logowanie ${login.status}`);
  process.exit(1);
}
const session = {
  cookie: (login.headers.getSetCookie()[0] ?? "").split(";")[0],
  csrf: login.json.csrf_token,
};
const product = await call("GET", `/v1/admin/products/${SLUG}`, { session });
const variant = product.json?.variants?.find((v) => v.sku === SKU);
if (!variant) {
  console.error("BLAD: brak wariantu");
  process.exit(1);
}
const next = variant.price_gr + 7700;
const changed = await call("PUT", `/v1/admin/variants/${SKU}/price`, {
  session,
  ifMatch: variant.version,
  body: { price_gr: next, reason: "smoke-outbox S30" },
});
if (changed.status !== 200) {
  console.error(`BLAD: zmiana ceny ${changed.status}`);
  process.exit(1);
}
console.log(`PRICE_GR=${next}`);
