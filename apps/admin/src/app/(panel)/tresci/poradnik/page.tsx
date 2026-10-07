// B-304 (TAKTYL-62): /tresci/poradnik.
import { ContentList } from "../../../../components/tresci/content-list";

export const metadata = { title: "Poradniki" };

export default function GuidesPage() {
  return <ContentList type="guide" />;
}
