import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { cx } from "../lib/cx.js";
import { ANIM_FALLBACK_MS } from "./use-presence.js";

/** Czas wyswietlania toastu (A-15, docs/06 §5). */
export const TOAST_MS = 4000;
/** Maksymalna liczba toastow naraz; starszy znika, gdy pojawia sie czwarty. */
export const TOAST_MAX = 3;

export interface ToastOptions {
  message: ReactNode;
  /** Etykieta opcjonalnego przycisku, zwykle "Cofnij" (docs/11 pkt 11: zamiast okna systemowego). */
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastEntry extends ToastOptions {
  id: number;
}

interface ToastApi {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const ToastListContext = createContext<{
  toasts: ToastEntry[];
  remove: (id: number) => void;
  duration: number;
} | null>(null);

export interface ToastProviderProps {
  children: ReactNode;
  /** Czas wyswietlania w ms (domyslnie 4000). */
  duration?: number;
  /** Maksymalna liczba toastow naraz (domyslnie 3). */
  max?: number;
  /** Gdy true, region nie jest renderowany automatycznie; umiesc <ToastRegion /> sam. */
  manualRegion?: boolean;
}

/** Dostawca toastow: udostepnia useToast() i renderuje ToastRegion. */
export function ToastProvider({
  children,
  duration = TOAST_MS,
  max = TOAST_MAX,
  manualRegion = false,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { ...options, id }].slice(-max));
      return id;
    },
    [max],
  );
  const remove = useCallback(
    (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );
  // dismiss usuwa od razu; animacje wyjscia obsluguje ToastItem przy wygasnieciu czasu
  const api = useMemo<ToastApi>(() => ({ toast, dismiss: remove }), [toast, remove]);
  const list = useMemo(() => ({ toasts, remove, duration }), [toasts, remove, duration]);

  return (
    <ToastContext.Provider value={api}>
      <ToastListContext.Provider value={list}>
        {children}
        {manualRegion ? null : <ToastRegion />}
      </ToastListContext.Provider>
    </ToastContext.Provider>
  );
}

/** Hook: toast({ message, actionLabel?, onAction? }) oraz dismiss(id). Wymaga ToastProvider. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast wymaga ToastProvider");
  return ctx;
}

/**
 * Region toastow (A-15): role="status" (aria-live polite), istnieje zanim pojawi sie pierwsza tresc.
 * Toast ma .sekcja--mod (ciemny zestaw tokenow), --r i --cien-2; warstwa --z-toast.
 */
export function ToastRegion() {
  const ctx = useContext(ToastListContext);
  if (!ctx) throw new Error("ToastRegion wymaga ToastProvider");
  return (
    <div
      className="tk-toasty"
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-relevant="additions"
    >
      {ctx.toasts.map((t) => (
        <ToastItem key={t.id} entry={t} duration={ctx.duration} onRemove={ctx.remove} />
      ))}
    </div>
  );
}

function ToastItem({
  entry,
  duration,
  onRemove,
}: {
  entry: ToastEntry;
  duration: number;
  onRemove: (id: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [animating, setAnimating] = useState(true);
  const remaining = useRef(duration);
  const paused = hover || focus;

  // Odliczanie z pauza na hover i fokus: zapamietujemy, ile czasu zostalo.
  useEffect(() => {
    if (paused || leaving) return undefined;
    const startedAt = Date.now();
    const t = setTimeout(() => setLeaving(true), remaining.current);
    return () => {
      clearTimeout(t);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [paused, leaving]);

  // Wejscie: will-change zdejmowane po animacji
  useEffect(() => {
    const t = setTimeout(() => setAnimating(false), ANIM_FALLBACK_MS);
    return () => clearTimeout(t);
  }, []);

  // Wyjscie: sam opacity; bez animacji (reduced-motion, brak CSS) znika od razu
  useLayoutEffect(() => {
    if (!leaving) return undefined;
    const name = ref.current ? getComputedStyle(ref.current).animationName : "none";
    if (!name || name === "none") {
      onRemove(entry.id);
      return undefined;
    }
    setAnimating(true);
    const t = setTimeout(() => onRemove(entry.id), ANIM_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [leaving, entry.id, onRemove]);

  return (
    <div
      ref={ref}
      className={cx("tk-toast", "sekcja--mod")}
      data-stan={leaving ? "zamykanie" : "otwarty"}
      data-anim={animating ? "" : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false);
      }}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        if (leaving) onRemove(entry.id);
        else setAnimating(false);
      }}
    >
      <span>{entry.message}</span>
      {entry.actionLabel ? (
        <button
          type="button"
          className="tk-toast__akcja"
          onClick={() => {
            entry.onAction?.();
            setLeaving(true);
          }}
        >
          {entry.actionLabel}
        </button>
      ) : null}
    </div>
  );
}
