import { SectionGate } from "@/components/access/Gate";
import { RidesView } from "@/views/RidesView";

export default function Page() {
  return (
    <SectionGate section="rides">
      <RidesView />
    </SectionGate>
  );
}
