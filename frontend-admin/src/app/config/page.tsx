import { SectionGate } from "@/components/access/Gate";
import { ConfigView } from "@/views/ConfigView";

export default function Page() {
  return (
    <SectionGate section="config">
      <ConfigView />
    </SectionGate>
  );
}
