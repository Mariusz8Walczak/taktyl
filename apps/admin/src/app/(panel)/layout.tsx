import type { ReactNode } from "react";

// Panel zalezy od sesji i adresu (useSearchParams): nigdy nie jest prerenderowany statycznie.
export const dynamic = "force-dynamic";
import { PanelShell } from "../../components/shell/panel-shell";

export default function PanelLayout({ children }: { children: ReactNode }) {
  return <PanelShell>{children}</PanelShell>;
}
