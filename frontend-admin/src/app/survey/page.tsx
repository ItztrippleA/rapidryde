import { SectionGate } from "@/components/access/Gate";
import { SurveyView } from "@/views/SurveyView";

export default function Page() {
  return (
    <SectionGate section="survey">
      <SurveyView />
    </SectionGate>
  );
}
