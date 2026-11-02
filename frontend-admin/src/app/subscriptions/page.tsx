import { SectionGate } from "@/components/access/Gate";
import { SubscriptionsView } from "@/views/SubscriptionsView";

export default function Page() {
  return (
    <SectionGate section="subscriptions">
      <SubscriptionsView />
    </SectionGate>
  );
}
