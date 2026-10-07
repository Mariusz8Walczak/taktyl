import { useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes } from "react";
import { callAll } from "../lib/compose.js";
import { cx } from "../lib/cx.js";
import { useKeyPress } from "../lib/use-key-press.js";
import { Icon } from "./icon.js";
import type { IconName } from "./icon.js";

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children" | "aria-pressed"
> {
  icon: IconName;
  /** Wymagany: przycisk bez widocznego tekstu (docs/09 §2). */
  "aria-label": string;
  /** Dla przelacznikow (np. ulubione): renderuje aria-pressed. */
  pressed?: boolean;
}

/** Zapas na animationend skoku A-10 (dluzszy niz --d-m = 220 ms); przy prefers-reduced-motion zdarzenie nie nadejdzie. */
const SKOK_FALLBACK_MS = 500;

/** A-10: true na czas skoku, tylko gdy przelacznik przechodzi z "nie" na "tak" (nie przy montowaniu, nie przy usuwaniu). */
function useAddedJump(pressed: boolean | undefined): [boolean, () => void] {
  const prev = useRef(pressed);
  const [jump, setJump] = useState(false);
  useEffect(() => {
    const was = prev.current;
    prev.current = pressed;
    if (!was && pressed) setJump(true);
    if (!pressed) setJump(false);
  }, [pressed]);
  useEffect(() => {
    if (!jump) return undefined;
    const t = setTimeout(() => setJump(false), SKOK_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [jump]);
  return [jump, () => setJump(false)];
}

/** Ikona-przycisk 44 x 44 (docs/06 §5), ikona szablonu 20 px. Przelacznik (pressed): A-10 skok przy dodaniu. */
export function IconButton({
  icon,
  pressed,
  className,
  type = "button",
  disabled,
  onKeyDown,
  ...rest
}: IconButtonProps) {
  const key = useKeyPress(Boolean(disabled));
  const [jump, endJump] = useAddedJump(pressed);
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-pressed={pressed}
      className={cx("tk-ikonka", key.pressed && "is-wcisniety", jump && "is-skok", className)}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && e.animationName === "tk-serce") endJump();
      }}
      onKeyDown={callAll(onKeyDown, key.onKeyDown)}
    >
      <Icon name={icon} />
    </button>
  );
}
