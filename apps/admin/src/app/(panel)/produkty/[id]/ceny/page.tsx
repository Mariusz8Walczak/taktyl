// B-105 (TAKTYL-51): /produkty/{id}/ceny - historia cen i wyliczone lowest_30d (tylko odczyt).
import { PriceHistoryView } from "../../../../../components/produkty/price-history-view";

export const metadata = { title: "Historia cen" };

export default async function PricesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PriceHistoryView id={id} />;
}
