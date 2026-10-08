import {
  Suspense,
  createContext,
  lazy,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

// Wyglad i odliczanie toastu to osobny modul ladowany przy pierwszym toascie (TAKTYL-67, budzet JS docs/12 par. 4);
// region role=status zostaje w paczce, wiec istnieje zanim pojawi sie tresc.
const loadToastItem = () => import("./toast-item.js");
const ToastItem = lazy(loadToastItem);

/** Czas wyswietlania toastu (A-15, docs/06 §5). */
export const TOAST_MS = 4000;
/** Maksymalna liczba toastow naraz; starszy znika, gdy pojawia sie czwarty. */
export const TOAST_MAX = 3;

export interface ToastOptions {
  message: ReactNode;
  /** Etykieta opcjonalnego przycisku, zwykle "Cofnij" (docs/11 pkt 11: zamiast okna systemowego). */
  actionLabel?: string;
  onAction?: () => void;
  /** Czas wyswietlania w ms dla tego komunikatu (domyslnie czas dostawcy, 4000); "Cofnij" w koszyku: 5000. */
  duration?: number;
}

export interface ToastEntry extends ToastOptions {
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
      void loadToastItem();
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
      <Suspense fallback={null}>
        {ctx.toasts.map((t) => (
          <ToastItem
            key={t.id}
            entry={t}
            duration={t.duration ?? ctx.duration}
            onRemove={ctx.remove}
          />
        ))}
      </Suspense>
    </div>
  );
}
