// B-305, B-306 (TAKTYL-62): /tresci/strony/{slug}.
import { ContentEditor } from "../../../../../components/tresci/content-editor";

export const metadata = { title: "Edycja strony" };

export default async function PageEdit({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ContentEditor type="page" slug={slug} />;
}
