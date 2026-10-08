import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cx } from "../lib/cx.js";
import { ANIM_FALLBACK_MS } from "./use-presence.js";
import type { ToastEntry } from "./toast.js";

/** Pojedynczy toast (A-15); osobny modul ladowany leniwie przy pierwszym toascie (TAKTYL-67, budzet JS). */
export default function ToastItem({
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
