import { SectionGate } from "@/components/access/Gate";
import { PricingView } from "@/views/PricingView";

export default function Page() {
  return (
    <SectionGate section="pricing">
      <PricingView />
    </SectionGate>
  );
}
