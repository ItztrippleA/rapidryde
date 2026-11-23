import { SectionGate } from "@/components/access/Gate";
import { DocView } from "@/views/DocView";

export default function Page() {
  return (
    <SectionGate section="doc">
      <DocView />
    </SectionGate>
  );
}
