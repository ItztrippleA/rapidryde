import { SectionGate } from "@/components/access/Gate";
import { EmailView } from "@/views/EmailView";

export default function Page() {
  return (
    <SectionGate section="email">
      <EmailView />
    </SectionGate>
  );
}
