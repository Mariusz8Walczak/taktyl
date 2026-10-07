import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx.js";
import { Icon } from "./icon.js";
import type { IconName } from "./icon.js";
import { VisuallyHidden } from "./visually-hidden.js";

export type AlertVariant = "sukces" | "uwaga" | "blad" | "info";

const WARIANTY: Record<AlertVariant, { icon: IconName; prefix: string; role: "status" | "alert" }> =
  {
    sukces: { icon: "check", prefix: "Sukces.", role: "status" },
    uwaga: { icon: "warning", prefix: "Uwaga.", role: "alert" },
    blad: { icon: "error", prefix: "Błąd.", role: "alert" },
    info: { icon: "info", prefix: "Informacja.", role: "status" },
  };

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant;
  title?: ReactNode;
  children: ReactNode;
}

/**
 * Komunikat w tresci: tlo --sukces-tlo / --uwaga-tlo / --blad-tlo / --tlo-alt (info), ikona + tekst.
 * Kolor nie jest jedynym nosnikiem: ikona oraz ukryty prefiks dla czytnika.
 */
export function Alert({ variant = "info", title, className, children, ...rest }: AlertProps) {
  const v = WARIANTY[variant];
  return (
    <div
      role={v.role}
      {...rest}
      className={cx("tk-komunikat", `tk-komunikat--${variant}`, className)}
    >
      <Icon name={v.icon} />
      <div className="tk-komunikat__tresc">
        <VisuallyHidden>{v.prefix} </VisuallyHidden>
        {title ? <strong className="tk-komunikat__tytul">{title}</strong> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

/** Nazwa z docs/06: komunikat w tresci. */
export const InlineMessage = Alert;
