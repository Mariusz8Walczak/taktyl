// B-060 (ADR-0003, docs/16 par. 3.6, docs/14 par. 7 A08): odbiornik webhooka rewalidacji api -> sklep.
// POST /api/revalidate: podpis X-Taktyl-Signature = hex(HMAC-SHA256(REVALIDATE_SECRET, `${timestamp}.${body}`)),
// X-Taktyl-Timestamp = sekundy unix, okno 5 minut (replay). Body: { tags: [...] } walidowane schematem z contracts
// (lista dozwolonych formatow znacznikow), potem revalidateTag dla kazdego. Zly podpis = 401 bez ujawniania powodu.
import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateRequestSchema } from "@taktyl/contracts";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_SKEW_SECONDS = 300;
/** Webhook ma male cialo (<= 50 znacznikow); wiekszych nie czytamy. */
const MAX_BODY_BYTES = 16 * 1024;

const problem = (status: number, code: string, detail: string): Response =>
  new Response(JSON.stringify({ status, code, detail }), {
    status,
    headers: { "content-type": "application/problem+json", "cache-control": "no-store" },
  });

/** Podpis w stalym czasie; zwraca true tylko dla poprawnego podpisu z oknem czasowym. */
function isAuthentic(
  secret: string,
  timestamp: string | null,
  signature: string | null,
  body: string,
  nowMs: number,
): boolean {
  if (!timestamp || !signature || !/^\d{1,12}$/.test(timestamp)) return false;
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest();
  const given = Buffer.from(signature, "hex");
  const signatureOk = given.length === expected.length && timingSafeEqual(given, expected);
  const fresh = Math.abs(nowMs / 1000 - Number(timestamp)) <= MAX_SKEW_SECONDS;
  return signatureOk && fresh;
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || secret.length < 32) {
    return problem(503, "internal_error", "Webhook nie jest skonfigurowany.");
  }

  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
    return problem(413, "validation_failed", "Zbyt duze cialo zadania.");
  }
  const ok = isAuthentic(
    secret,
    request.headers.get("x-taktyl-timestamp"),
    request.headers.get("x-taktyl-signature"),
    body,
    Date.now(),
  );
  if (!ok) return problem(401, "unauthorized", "Niepoprawny podpis.");

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return problem(422, "validation_failed", "Cialo nie jest poprawnym JSON.");
  }
  const parsed = revalidateRequestSchema.safeParse(json);
  if (!parsed.success) {
    return problem(422, "validation_failed", "Niedozwolony format znacznikow.");
  }

  const tags = [...new Set(parsed.data.tags)];
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: tags }, { headers: { "cache-control": "no-store" } });
}
