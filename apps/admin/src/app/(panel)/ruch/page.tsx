// B-620 (docs/25 par. 2): ruch w sklepie z kolektora zdarzen (ADR-0012).
import { TrafficView } from "../../../components/ruch/traffic-view";

export const metadata = { title: "Ruch" };

export default function TrafficPage() {
  return <TrafficView />;
}
