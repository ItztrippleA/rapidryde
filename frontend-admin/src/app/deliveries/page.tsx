import { SectionGate } from "@/components/access/Gate";
import { DeliveriesView } from "@/views/DeliveriesView";

export default function Page() {
  return (
    <SectionGate section="deliveries">
      <DeliveriesView />
    </SectionGate>
  );
}
