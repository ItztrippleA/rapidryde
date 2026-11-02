import { SectionGate } from "@/components/access/Gate";
import { AccessView } from "@/views/AccessView";

export default function Page() {
  return (
    <SectionGate section="access">
      <AccessView />
    </SectionGate>
  );
}
