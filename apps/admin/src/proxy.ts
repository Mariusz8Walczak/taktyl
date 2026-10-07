// B-002 (ochrona tras): bez ciasteczka sesji przekierowanie na /logowanie przed renderem. To tylko wygoda (nie ma
// migotania zawartosci); prawdziwa kontrole robi API (401) i AuthProvider. Next 16: plik `proxy.ts` zastepuje `middleware.ts`.
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "taktyl_session";

export function proxy(req: NextRequest) {
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  const url = req.nextUrl.clone();
  url.pathname = "/logowanie";
  url.search = "";
  const next = pathname + search;
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  // Poza logowaniem, zasobami Next, route handlerami (health, proxy API) i plikami z kropka.
  matcher: ["/((?!logowanie|v1/|api/|_next/|.*[.].*).*)"],
};
