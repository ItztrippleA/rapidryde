import { SectionGate } from "@/components/access/Gate";
import { NotificationsView } from "@/views/NotificationsView";

export default function Page() {
  return (
    <SectionGate section="notifications">
      <NotificationsView />
    </SectionGate>
  );
}
