// B-232 (docs/14 par. 7): limity zadan na endpoint (okno 60 s, per IP). Zaostrzone dla zamowien i platnosci.
// I-009 (B-007, TAKTYL-65): w DEMO_MODE publiczne demo dostaje dodatkowy sufit (DEMO_THROTTLE_READ_LIMIT dla odczytu,
// DEMO_THROTTLE_WRITE_LIMIT dla zapisow/logowania/formularzy); limit = min(limit bazowy, sufit). Bez DEMO_MODE nic sie nie zmienia.
export const RATE_WINDOW_MS = 60_000;

interface DemoThrottleConfig {
  DEMO_MODE: boolean;
  DEMO_THROTTLE_READ_LIMIT: number;
  DEMO_THROTTLE_WRITE_LIMIT: number;
}

const caps = { read: Number.POSITIVE_INFINITY, write: Number.POSITIVE_INFINITY };

/** Wolane raz przy starcie aplikacji (ThrottlerModule.forRootAsync); ustawia sufity trybu demo. */
export function configureDemoThrottle(c: DemoThrottleConfig): void {
  caps.read = c.DEMO_MODE ? c.DEMO_THROTTLE_READ_LIMIT : Number.POSITIVE_INFINITY;
  caps.write = c.DEMO_MODE ? c.DEMO_THROTTLE_WRITE_LIMIT : Number.POSITIVE_INFINITY;
}

/** Limit rozstrzygany przy kazdym zadaniu (throttler przyjmuje funkcje), wiec sufit demo dziala bez zmiany dekoratorow. */
const read = (base: number) => () => Math.min(base, caps.read);
const write = (base: number) => () => Math.min(base, caps.write);

export const LIMITS = {
  /** Domyslny limit publicznego odczytu. */
  default: { limit: read(120), ttl: RATE_WINDOW_MS },
  /** POST /orders: 10/min/IP. */
  orderCreate: { limit: write(10), ttl: RATE_WINDOW_MS },
  /** POST /orders/{n}/payment/simulate: 20/min/IP. */
  payment: { limit: write(20), ttl: RATE_WINDOW_MS },
  /** POST /cart/quote: 60/min/IP. */
  quote: { limit: read(60), ttl: RATE_WINDOW_MS },
  /** B-004: POST /admin/auth/login i demo-viewer: 10/min/IP (dodatkowo licznik prob na konto i IP w bazie). */
  login: { limit: write(10), ttl: RATE_WINDOW_MS },
  /** F-221, F-223: POST /forms/contact i /forms/newsletter: 5/min/IP na endpoint (docs/14 par. 7). */
  form: { limit: write(5), ttl: RATE_WINDOW_MS },
  /** Odczyt zamowien po tokenie (zgadywanie tokenow): 30/min/IP. */
  orderRead: { limit: read(30), ttl: RATE_WINDOW_MS },
  /** I-009 (B-014): POST /admin/demo/reset - reset jest ciezki, wiec 2/min/IP. */
  demoReset: { limit: 2, ttl: RATE_WINDOW_MS },
} as const;
