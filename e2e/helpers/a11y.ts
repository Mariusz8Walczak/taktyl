// I-010 (TAKTYL-44): pomocnik axe-core dla zadan dostepnosci (TAKTYL-66): "0 bledow krytycznych i powaznych" (docs/12 par. 6).
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

export async function axeBlockingViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return result.violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => n.target.join(" ")).slice(0, 5),
    }));
}
