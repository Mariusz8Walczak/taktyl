// B-102, B-103 (TAKTYL-51): /produkty/{id}.
import { ProductEditor } from "../../../../components/produkty/product-editor";

export const metadata = { title: "Edycja produktu" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductEditor id={id} />;
}
