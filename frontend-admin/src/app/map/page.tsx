import { SectionGate } from "@/components/access/Gate";
import { MapView } from "@/views/MapView";

export default function Page() {
  return (
    <SectionGate section="map">
      <MapView />
    </SectionGate>
  );
}
