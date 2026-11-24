import { Suspense } from "react";
import Box from "@mui/material/Box";
import { SectionGate } from "@/components/access/Gate";
import { SupportView } from "@/views/SupportView";

export default function Page() {
  return (
    <SectionGate section="support">
      <Suspense fallback={<Box sx={{ p: 2 }}>Loading chat…</Box>}>
        <SupportView />
      </Suspense>
    </SectionGate>
  );
}
