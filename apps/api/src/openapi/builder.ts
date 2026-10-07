// B-231 (docs/16 uwagi wstepne): dokument OpenAPI 3.1 generowany ze schematow Zod z @taktyl/contracts
// (z.toJSONSchema, draft 2020-12 = JSON Schema OpenAPI 3.1). Zadnych recznie pisanych kopii kształtow.
import { problemSchema } from "@taktyl/contracts";
import { z } from "zod";
import { CSRF_HEADER, ROUTES, type RouteDoc } from "./routes.js";

type Json = Record<string, unknown>;

function jsonSchema(schema: z.ZodType, io: "input" | "output"): Json {
  const out = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io,
    unrepresentable: "any",
  }) as Json;
  delete out["$schema"];
  return out;
}

/** Parametry zapytania z wlasciwosci schematu obiektu (kazda wlasciwosc = jeden parametr). */
function queryParameters(schema: z.ZodType): Json[] {
  const js = jsonSchema(schema, "input");
  const props = (js["properties"] ?? {}) as Record<string, Json>;
  const required = new Set((js["required"] ?? []) as string[]);
  return Object.entries(props).map(([name, s]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema: s,
  }));
}

const PROBLEM_REF = { $ref: "#/components/schemas/Problem" };

function problemResponse(description: string): Json {
  return { description, content: { "application/problem+json": { schema: PROBLEM_REF } } };
}

function operation(route: RouteDoc): Json {
  const parameters: Json[] = [
    ...Object.entries(route.pathParams ?? {}).map(([name, description]) => ({
      name,
      in: "path",
      required: true,
      description,
      schema: { type: "string" },
    })),
    ...(route.query ? queryParameters(route.query) : []),
    ...[
      ...(route.headers ?? []),
      ...(route.security === "session" && route.method !== "get" ? [CSRF_HEADER] : []),
    ].map((h) => ({
      name: h.name,
      in: "header",
      required: h.required,
      description: h.description,
      schema: { type: "string" },
    })),
  ];
  const responses: Record<string, Json> = {
    [String(route.success.status)]: {
      description: route.success.description,
      ...(route.success.schema
        ? {
            content: { "application/json": { schema: jsonSchema(route.success.schema, "output") } },
          }
        : {}),
      ...(route.noStore
        ? { headers: { "Cache-Control": { schema: { type: "string", const: "no-store" } } } }
        : {}),
    },
  };
  if (route.query || route.body) {
    responses[route.body ? "422" : "400"] = problemResponse("validation_failed");
  }
  for (const e of route.errors ?? []) {
    responses[String(e.status)] = problemResponse(e.code);
  }
  if (route.security === "session") {
    responses["401"] = problemResponse("unauthorized (brak lub wygasla sesja)");
    responses["403"] = problemResponse(
      route.method === "get"
        ? "forbidden (rola za niska)"
        : "forbidden (rola za niska) | csrf_invalid",
    );
  }
  if (route.path.startsWith("/v1/"))
    responses["429"] = problemResponse("rate_limited (naglowek Retry-After)");
  responses["500"] = problemResponse("internal_error");
  return {
    tags: [route.tag],
    summary: route.summary,
    description: `ID: ${route.ids.join(", ")}${route.role ? `. Minimalna rola: ${route.role}.` : ""}`,
    operationId: `${route.method}${route.path.replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ""))}`,
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(route.body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: jsonSchema(route.body, "input") } },
          },
        }
      : {}),
    ...(route.security === "orderToken" ? { security: [{ OrderToken: [] }] } : {}),
    ...(route.security === "session" ? { security: [{ AdminSession: [] }] } : {}),
    responses,
  };
}

export function buildOpenApi(): Json {
  const paths: Record<string, Json> = {};
  for (const route of ROUTES) {
    (paths[route.path] ??= {})[route.method] = operation(route);
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Taktyl API",
      version: "1.0.0",
      description:
        "Kontrakt REST sklepu demonstracyjnego Taktyl (docs/16). Kwoty w groszach (pola z sufiksem _gr). Bledy: application/problem+json (RFC 9457).",
    },
    servers: [{ url: "/" }],
    tags: [...new Set(ROUTES.map((r) => r.tag))].map((name) => ({ name })),
    paths,
    components: {
      schemas: { Problem: jsonSchema(problemSchema, "output") },
      securitySchemes: {
        AdminSession: {
          type: "apiKey",
          in: "cookie",
          name: "taktyl_session",
          description:
            "Sesja backpanelu (HttpOnly; SameSite=Strict); mutacje wymagaja tez X-CSRF-Token (ADR-0006).",
        },
        OrderToken: {
          type: "apiKey",
          in: "header",
          name: "X-Order-Token",
          description: "Token zamowienia (ADR-0007).",
        },
      },
    },
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strona /docs: lista endpointow bez skryptow i stylow (CSP: default-src 'none'). */
export function renderDocsHtml(): string {
  const rows = ROUTES.map(
    (r) =>
      `<tr><td>${r.method.toUpperCase()}</td><td><code>${escapeHtml(r.path)}</code></td><td>${escapeHtml(r.summary)}</td><td>${escapeHtml(r.ids.join(", "))}</td></tr>`,
  ).join("\n");
  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Taktyl API</title>
</head>
<body>
<h1>Taktyl API (OpenAPI 3.1)</h1>
<p>Sklep demonstracyjny. Kontrakt: <a href="/openapi.json">/openapi.json</a>. Kwoty w groszach, bledy jako application/problem+json.</p>
<table>
<thead><tr><th>Metoda</th><th>Sciezka</th><th>Opis</th><th>ID</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>
`;
}
