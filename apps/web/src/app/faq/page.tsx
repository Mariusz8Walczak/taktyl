// F-221 (docs/05 §8, wzorzec: `faq` / harmonijka, docs/08 §6): /faq - pytania i odpowiedzi z API (tag content:faq).
// Bez danych strukturalnych FAQPage (sklep demo z noindex, tresci przykladowe). Harmonijka to jedyna wyspa kliencka.
import type { Metadata } from "next";
import { Breadcrumbs } from "../../components/breadcrumbs";
import { Markdown } from "../../components/content/markdown";
import { FaqAccordion } from "../../components/faq/faq-accordion";
import { getFaq } from "../../lib/api";
import { absoluteUrl } from "../../lib/site";

export const metadata: Metadata = {
  title: "Pytania i odpowiedzi",
  description: "Odpowiedzi na najczęstsze pytania o sklep demonstracyjny Taktyl.",
  alternates: { canonical: absoluteUrl("/faq") },
  robots: { index: false, follow: false },
};

export default async function FaqPage() {
  const items = await getFaq();
  return (
    <div className="kontener strona">
      <Breadcrumbs
        items={[{ label: "Strona główna", href: "/" }, { label: "Pytania i odpowiedzi" }]}
      />
      <h1 className="naglowek-strony">Pytania i odpowiedzi</h1>
      <p className="wstep">
        Taktyl to sklep demonstracyjny. Poniżej odpowiedzi na to, o co pytają najczęściej.
      </p>
      <FaqAccordion
        items={items.map((it, i) => ({
          key: `${i}`,
          question: it.question,
          answer: <Markdown markdown={it.answer_md} />,
        }))}
      />
    </div>
  );
}
