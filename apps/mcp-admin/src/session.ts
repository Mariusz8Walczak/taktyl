// I-014 (B-001): sesja backpanelu dla serwera MCP. Loguje sie leniwie (przy pierwszym zadaniu), trzyma ciasteczko taktyl_session
// w pamieci klienta, dokleja X-CSRF-Token do mutacji, a po 401 loguje ponownie i po 403 csrf_invalid odswieza token (jedna
// ponowna proba). Mutacje ida wylacznie przez /v1/admin/*, wiec audit_log i outbox dzialaja jak w panelu.
import { sessionResponseSchema } from "@taktyl/contracts";
import {
  ApiError,
  createApiClient,
  createRedactor,
  type ApiClient,
  type ApiClientOptions,
} from "@taktyl/mcp-core";
import type { AdminConfig } from "./config";

export interface AdminApi {
  api: ApiClient;
  /** Maskuje haslo, token CSRF i ciasteczko sesji w tekscie zwracanym narzedziom. */
  redact: (text: string) => string;
}

const LOGIN = "/v1/admin/auth/login";
const DEMO = "/v1/admin/auth/demo-viewer";
const ME = "/v1/admin/auth/me";
const isAuthPath = (path: string) => path === LOGIN || path === DEMO;

export function createAdminApi(
  config: AdminConfig,
  fetchImpl?: ApiClientOptions["fetch"],
): AdminApi {
  let csrf: string | undefined;
  let pending: Promise<void> | undefined;
  let ready = false;

  const base: ApiClientOptions = {
    baseUrl: config.TAKTYL_API_URL,
    useCookies: true,
    extraHeaders: (method): Record<string, string> =>
      method !== "GET" && csrf ? { "x-csrf-token": csrf } : {},
    onAuthFailure: async (error, path) => {
      if (isAuthPath(path)) return false;
      if (error.status === 403) {
        try {
          await refresh();
          return true;
        } catch {
          // sesja wygasla: nizej logowanie od nowa
        }
      }
      ready = false;
      await ensure("/");
      return ready;
    },
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  };
  const client = createApiClient(base);

  async function establish(): Promise<void> {
    const demo = !config.TAKTYL_ADMIN_EMAIL || !config.TAKTYL_ADMIN_PASSWORD;
    if (demo && !config.TAKTYL_ADMIN_DEMO) {
      throw new ApiError(
        401,
        "unauthorized",
        "Brak poswiadczen: ustaw TAKTYL_ADMIN_EMAIL i TAKTYL_ADMIN_PASSWORD albo TAKTYL_ADMIN_DEMO=true (rola viewer).",
      );
    }
    const res = demo
      ? await client.request("POST", DEMO, { body: {}, schema: sessionResponseSchema })
      : await client.request("POST", LOGIN, {
          body: { email: config.TAKTYL_ADMIN_EMAIL, password: config.TAKTYL_ADMIN_PASSWORD },
          schema: sessionResponseSchema,
        });
    csrf = res.data.csrf_token;
    ready = true;
  }

  async function refresh(): Promise<void> {
    const res = await client.request("GET", ME, { schema: sessionResponseSchema });
    csrf = res.data.csrf_token;
  }

  async function ensure(path: string): Promise<void> {
    if (ready || isAuthPath(path)) return;
    pending ??= establish().finally(() => {
      pending = undefined;
    });
    await pending;
  }

  const api: ApiClient = {
    baseUrl: client.baseUrl,
    cookieValues: () => client.cookieValues(),
    async request(method, path, options) {
      await ensure(path);
      return client.request(method, path, options);
    },
    async get(path, options) {
      await ensure(path);
      return client.get(path, options);
    },
  };

  return {
    api,
    redact: createRedactor(() => [config.TAKTYL_ADMIN_PASSWORD, csrf, ...client.cookieValues()]),
  };
}
