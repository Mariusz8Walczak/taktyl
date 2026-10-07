// B-232 (docs/14 par. 7): limity zadan na endpoint (okno 60 s, per IP). Zaostrzone dla zamowien i platnosci.
export const RATE_WINDOW_MS = 60_000;

export const LIMITS = {
  /** Domyslny limit publicznego odczytu. */
  default: { limit: 120, ttl: RATE_WINDOW_MS },
  /** POST /orders: 10/min/IP. */
  orderCreate: { limit: 10, ttl: RATE_WINDOW_MS },
  /** POST /orders/{n}/payment/simulate: 20/min/IP. */
  payment: { limit: 20, ttl: RATE_WINDOW_MS },
  /** POST /cart/quote: 60/min/IP. */
  quote: { limit: 60, ttl: RATE_WINDOW_MS },
  /** B-004: POST /admin/auth/login i demo-viewer: 10/min/IP (dodatkowo licznik prob na konto i IP w bazie). */
  login: { limit: 10, ttl: RATE_WINDOW_MS },
  /** Odczyt zamowien po tokenie (zgadywanie tokenow): 30/min/IP. */
  orderRead: { limit: 30, ttl: RATE_WINDOW_MS },
} as const;
