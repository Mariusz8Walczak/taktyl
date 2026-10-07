// ADM-001 (B-002, B-003): same-origin proxy do API. Przegladarka rozmawia tylko z hostem backpanelu, wiec nie ma CORS,
// ciasteczko sesji (HttpOnly, SameSite=Strict) jest first-party, a adres API (INTERNAL_API_URL) czytany jest w czasie
// dzialania kontenera, nie w czasie budowy. Przekazujemy tylko to, czego API potrzebuje; nic nie jest buforowane.
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const FORWARD_REQUEST = [
  "accept",
  "content-type",
  "cookie",
  "if-match",
  "user-agent",
  "x-csrf-token",
  "x-forwarded-for",
  "x-request-id",
];
const FORWARD_RESPONSE = [
  "content-type",
  "etag",
  "retry-after",
  "x-request-id",
  "content-disposition",
];

function apiBase(): string {
  return (
    process.env.INTERNAL_API_URL ??
    process.env.API_URL_INTERNAL ??
    "http://localhost:4000"
  ).replace(/\/$/, "");
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  const target = `${apiBase()}/v1/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return Response.json(
      {
        type: "about:blank",
        title: "API niedostępne",
        status: 502,
        code: "internal_error",
        detail: "Nie udało się połączyć z API.",
      },
      { status: 502, headers: { "Content-Type": "application/problem+json" } },
    );
  }

  const out = new Headers();
  for (const name of FORWARD_RESPONSE) {
    const v = upstream.headers.get(name);
    if (v) out.set(name, v);
  }
  for (const cookie of upstream.headers.getSetCookie()) out.append("set-cookie", cookie);
  out.set("Cache-Control", "no-store");
  const noBody = upstream.status === 204 || upstream.status === 304;
  return new Response(noBody ? null : upstream.body, { status: upstream.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
