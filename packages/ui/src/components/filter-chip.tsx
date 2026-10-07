import type { ButtonHTMLAttributes, ReactNode } from "react";
import { callAll } from "../lib/compose.js";
import { cx } from "../lib/cx.js";
import { useKeyPress } from "../lib/use-key-press.js";
import { Icon } from "./icon.js";

export interface FilterChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-pressed" | "children"
> {
  active?: boolean;
  children: ReactNode;
}

/** Zeton filtra: 44 px, --r-pelny; aktywny: tlo --akcent-slaby, obrys --akcent i ikona "×". */
export function FilterChip({
  active = false,
  className,
  type = "button",
  disabled,
  onKeyDown,
  children,
  ...rest
}: FilterChipProps) {
  const key = useKeyPress(Boolean(disabled));
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled}
      aria-pressed={active}
      className={cx("tk-zeton", active && "is-aktywny", key.pressed && "is-wcisniety", className)}
      onKeyDown={callAll(onKeyDown, key.onKeyDown)}
    >
      <span>{children}</span>
      {active ? <Icon name="close" /> : null}
    </button>
  );
}
