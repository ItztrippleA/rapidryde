import { SectionGate } from "@/components/access/Gate";
import { SupportView } from "@/views/SupportView";

export default function Page() {
  return (
    <SectionGate section="support">
      <SupportView />
    </SectionGate>
  );
}
