// B-600..B-619 (docs/25 par. 2): pulpit - statystyki z /v1/admin/stats/*, operacje i aktywnosc.
import { DashboardView } from "../../components/pulpit/dashboard-view";

export const metadata = { title: "Pulpit" };

export default function DashboardPage() {
  return <DashboardView />;
}
