// B-304 (TAKTYL-62): /tresci/poradnik/{slug}.
import { ContentEditor } from "../../../../../components/tresci/content-editor";

export const metadata = { title: "Edycja poradnika" };

export default async function GuideEdit({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ContentEditor type="guide" slug={slug} />;
}
