// F-001: skrypt przed malowaniem, zapobiega mignieciu paska zamknietego w tej sesji (patrz demo-bar.tsx).
import { DEMO_BAR_SCRIPT } from "./demo-bar";

export function DemoBarScript() {
  return <script dangerouslySetInnerHTML={{ __html: DEMO_BAR_SCRIPT }} />;
}
