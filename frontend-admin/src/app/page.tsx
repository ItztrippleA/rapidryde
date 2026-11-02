import { SectionGate } from "@/components/access/Gate";
import { DashboardView } from "@/views/DashboardView";

export default function Page() {
  return (
    <SectionGate section="dashboard">
      <DashboardView />
    </SectionGate>
  );
}
