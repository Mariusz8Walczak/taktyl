// F-221, F-242 (docs/05 §8, wzorzec: `contact-us` z formularzem, docs/08 §6): /kontakt - tresc strony z API (dane
// fikcyjne w domenie taktyl.example, tag content:kontakt) i formularz (e-mail, temat, wiadomosc). Formularz to wyspa
// kliencka; po 201 wysyla `generate_lead` (form_id kontakt).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "../../components/breadcrumbs";
import { Markdown } from "../../components/content/markdown";
import { ContactForm } from "../../components/forms/contact-form";
import { getContentPage } from "../../lib/api";
import { absoluteUrl } from "../../lib/site";
import { applyNbsp } from "@taktyl/domain";

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Dane kontaktowe sklepu demonstracyjnego Taktyl i formularz kontaktowy.",
  alternates: { canonical: absoluteUrl("/kontakt") },
  robots: { index: false, follow: false },
};

export default async function ContactPage() {
  const page = await getContentPage("kontakt");
  if (!page) notFound();
  return (
    <div className="kontener strona">
      <Breadcrumbs items={[{ label: "Strona główna", href: "/" }, { label: page.title }]} />
      <h1 className="naglowek-strony">{applyNbsp(page.title)}</h1>
      {page.lead ? <p className="wstep">{applyNbsp(page.lead)}</p> : null}
      <Markdown markdown={page.body_md} />
      <ContactForm />
    </div>
  );
}
