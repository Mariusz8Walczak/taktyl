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

/** Ikona-przycisk 44 x 44 (docs/06 §5), ikona szablonu 20 px. */
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
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-pressed={pressed}
      className={cx("tk-ikonka", key.pressed && "is-wcisniety", className)}
      onKeyDown={callAll(onKeyDown, key.onKeyDown)}
    >
      <Icon name={icon} />
    </button>
  );
}
