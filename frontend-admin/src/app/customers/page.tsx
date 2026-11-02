import { SectionGate } from "@/components/access/Gate";
import { CustomersView } from "@/views/CustomersView";

export default function Page() {
  return (
    <SectionGate section="customers">
      <CustomersView />
    </SectionGate>
  );
}
