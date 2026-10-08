// F-220 (docs/05 §1, wzorzec: `blog-details`, docs/08 §6): /poradnik/{slug} - artykul z API (tresc po sanityzacji),
// spis tresci z H2, okruszki, JSON-LD Article, CTA do kreatora z profilem. Tagi: content:{slug}, content:guide, rules.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "../../../components/breadcrumbs";
import { GuideArticle } from "../../../components/guides/guide-article";
import { getGuide } from "../../../lib/api";
import { getRules } from "../../../lib/builder/data";
import { articleJsonLd } from "../../../lib/content/article-json-ld";
import { jsonLdString } from "../../../lib/json-ld";
import { absoluteUrl } from "../../../lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) return { title: "Nie ma takiej strony", robots: { index: false, follow: false } };
  return {
    title: guide.title,
    ...(guide.lead ? { description: guide.lead } : {}),
    alternates: { canonical: absoluteUrl(`/poradnik/${guide.slug}`) },
    robots: { index: false, follow: false },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) notFound();
  const rules = await getRules();
  const profileLabel = guide.guide_profile
    ? (rules.profiles[guide.guide_profile]?.label ?? null)
    : null;
  return (
    <div className="kontener strona">
      <Breadcrumbs
        items={[
          { label: "Strona główna", href: "/" },
          { label: "Poradnik", href: "/poradnik" },
          { label: guide.title },
        ]}
      />
      <GuideArticle
        slug={guide.slug}
        title={guide.title}
        lead={guide.lead}
        body={guide.body_md}
        profile={guide.guide_profile}
        profileLabel={profileLabel}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            articleJsonLd({
              slug: guide.slug,
              title: guide.title,
              lead: guide.lead,
              publishedAt: guide.published_at,
            }),
          ),
        }}
      />
    </div>
  );
}
