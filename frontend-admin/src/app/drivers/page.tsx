import { SectionGate } from "@/components/access/Gate";
import { DriversView } from "@/views/DriversView";

export default function Page() {
  return (
    <SectionGate section="drivers">
      <DriversView />
    </SectionGate>
  );
}
