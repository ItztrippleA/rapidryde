import { SectionGate } from "@/components/access/Gate";
import { ZonesView } from "@/views/ZonesView";

export default function Page() {
  return (
    <SectionGate section="zones">
      <ZonesView />
    </SectionGate>
  );
}
