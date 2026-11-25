// F-242, ADR-0012 (B-621): wysylka zdarzen do kolektora - tylko po zgodzie, paczki <= 20, nazwy z docs/10, ciche bledy.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONSENT_KEY } from "../src/lib/consent/consent";
import { track } from "../src/lib/track";
import {
  API_META,
  EVENTS_BATCH_MAX,
  FLUSH_MS,
  flushEvents,
  resetCollector,
  sessionId,
} from "../src/lib/track-collector";
// @ts-expect-error plik .mjs bez deklaracji typow
import { buildCsp } from "../csp.mjs";

function grant(analytics: boolean) {
  window.localStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({ v: 1, analytics, marketing: false, at: "2026-11-25T10:00:00Z" }),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetCollector();
  vi.useFakeTimers();
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
  vi.stubGlobal("fetch", fetchMock);
  const meta = document.createElement("meta");
  meta.name = API_META;
  meta.content = "http://api.taktyl.localhost:8190/";
  document.head.append(meta);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.head.querySelector(`meta[name="${API_META}"]`)?.remove();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const bodies = () =>
  fetchMock.mock.calls.map(
    (c) =>
      JSON.parse((c[1] as RequestInit).body as string) as {
        session_id: string;
        events: { name: string; params: Record<string, unknown>; ts: string }[];
      },
  );

describe("kolektor zdarzen (ADR-0012)", () => {
  it("bez zgody na analityke nic nie wychodzi (dataLayer dziala jak dotad)", () => {
    grant(false);
    window.dataLayer = [];
    track("search", { search_term: "cicha" });
    vi.advanceTimersByTime(FLUSH_MS + 1);
    flushEvents(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.dataLayer).toContainEqual({ event: "search", search_term: "cicha" });
  });

  it("po zgodzie: paczka { session_id, events: [{ name, params, ts }] } na {API}/v1/events po FLUSH_MS", () => {
    grant(true);
    track("search", { search_term: "cicha" });
    track("shortcut_use", { key: "/" });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(FLUSH_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.taktyl.localhost:8190/v1/events");
    const [b] = bodies();
    expect(b?.session_id).toBe(sessionId());
    expect(b?.session_id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(b?.events.map((e) => e.name)).toEqual(["search", "shortcut_use"]);
    expect(b?.events[0]?.params).toEqual({ search_term: "cicha" });
    expect(Number.isNaN(Date.parse(b?.events[0]?.ts ?? ""))).toBe(false);
  });

  it("maks. 20 zdarzen w paczce; nazwy spoza docs/10 (np. page_view) nie sa wysylane", () => {
    grant(true);
    track("page_view", { path: "/" });
    for (let i = 0; i < EVENTS_BATCH_MAX + 3; i++)
      track("filter_apply", {
        item_list_id: "klawiatury",
        filter_name: "rozmiar",
        filter_value: String(i),
      });
    flushEvents(true);
    const sizes = bodies().map((b) => b.events.length);
    expect(sizes).toEqual([20, 3]);
    expect(bodies().flatMap((b) => b.events.map((e) => e.name))).not.toContain("page_view");
  });

  it("blad sieci jest cichy", () => {
    grant(true);
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("siec")));
    expect(() => {
      track("search", { search_term: "x" });
      flushEvents(true);
    }).not.toThrow();
  });

  it("CSP dopuszcza origin API w connect-src", () => {
    expect(buildCsp({ apiUrl: "http://api.taktyl.localhost:8190" })).toContain(
      "connect-src 'self' http://api.taktyl.localhost:8190",
    );
  });
});
