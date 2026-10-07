// B-302, B-303 (TAKTYL-62): /tresci/opinie/{id}.
import { ReviewsEditor } from "../../../../../components/tresci/reviews";

export const metadata = { title: "Edycja opinii" };

export default async function ReviewsEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewsEditor id={id} />;
}
