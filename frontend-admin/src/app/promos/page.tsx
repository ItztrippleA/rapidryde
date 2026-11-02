import { SectionGate } from "@/components/access/Gate";
import { PromosView } from "@/views/PromosView";

export default function Page() {
  return (
    <SectionGate section="promos">
      <PromosView />
    </SectionGate>
  );
}
