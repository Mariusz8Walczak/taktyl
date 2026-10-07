import type { ReactNode } from "react";
import { cx } from "../lib/cx.js";

export interface SpecRow {
  label: ReactNode;
  value: ReactNode;
}

export interface SpecTableProps {
  rows: readonly SpecRow[];
  /** Podpis tabeli widoczny dla czytnika (nazwa dostepna). */
  caption: string;
  className?: string;
}

/** Tabela specyfikacji: th wiersza --tekst-slaby 400, td --tekst, podzialy --linia (docs/06 §5). */
export function SpecTable({ rows, caption, className }: SpecTableProps) {
  return (
    <table className={cx("tk-spec", className)}>
      <caption className="tk-sr-only">{caption}</caption>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <th scope="row">{row.label}</th>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
