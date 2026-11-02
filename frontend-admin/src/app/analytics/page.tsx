import { SectionGate } from "@/components/access/Gate";
import { AnalyticsView } from "@/views/AnalyticsView";

export default function Page() {
  return (
    <SectionGate section="analytics">
      <AnalyticsView />
    </SectionGate>
  );
}
