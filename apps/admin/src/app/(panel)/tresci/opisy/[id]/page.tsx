// B-300, B-301 (TAKTYL-62): /tresci/opisy/{id}.
import { DescriptionEditor } from "../../../../../components/tresci/description-editor";

export const metadata = { title: "Edycja opisu" };

export default async function DescriptionEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DescriptionEditor id={id} />;
}
