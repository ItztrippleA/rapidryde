"use client";

import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { PageHeader, Pill } from "@/components/ui/Chrome";
import { appDocs, type AppDoc, type DocSection } from "@/lib/appDocs";

export function DocView() {
  const [tab, setTab] = useState(0);
  const doc = appDocs[tab] ?? appDocs[0];

  return (
    <Box>
      <PageHeader
        kicker="System"
        title="Doc"
        lede="Product outline of what ships in the customer and driver apps today — screens, behaviours, limits, and known gaps."
      />

      <Tabs
        value={tab}
        onChange={(_, value: number) => setTab(value)}
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        {appDocs.map((item) => (
          <Tab key={item.id} label={item.label} />
        ))}
      </Tabs>

      <AppDocPanel key={doc.id} doc={doc} />
    </Box>
  );
}

function AppDocPanel({ doc }: { doc: AppDoc }) {
  const [active, setActive] = useState("screens");

  useEffect(() => {
    setActive("screens");
  }, [doc.id]);

  const current = doc.sections.find((section) => section.id === active);

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ p: 2.5, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
        <Typography variant="h3" sx={{ mb: 0.8 }}>{doc.label}</Typography>
        <Typography color="text.secondary" sx={{ fontSize: 14, lineHeight: 1.55, maxWidth: 760 }}>
          {doc.summary}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mt: 1.6 }}>
          <Pill tone="ok">{doc.screens.length} screens</Pill>
          <Pill>{doc.sections.length} feature areas</Pill>
          <Pill tone="warn">{doc.gaps.length} known gaps</Pill>
        </Box>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "240px 1fr" }, gap: 2, alignItems: "start" }}>
        <Box sx={{ p: 1.5, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper", display: "grid", gap: 0.4, position: { lg: "sticky" }, top: { lg: 16 } }}>
          <NavButton label="Screens" active={active === "screens"} onClick={() => setActive("screens")} />
          <NavButton label="Limits" active={active === "limits"} onClick={() => setActive("limits")} />
          <NavButton label="Known gaps" active={active === "gaps"} onClick={() => setActive("gaps")} />
          <Box sx={{ height: 1, bgcolor: "divider", my: 0.6 }} />
          {doc.sections.map((section) => (
            <NavButton
              key={section.id}
              label={section.title}
              active={active === section.id}
              onClick={() => setActive(section.id)}
            />
          ))}
        </Box>

        <Box sx={{ display: "grid", gap: 2 }}>
          {active === "screens" ? (
            <Panel title="Screens">
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8 }}>
                {doc.screens.map((screen) => (
                  <Pill key={screen}>{screen}</Pill>
                ))}
              </Box>
            </Panel>
          ) : null}

          {active === "limits" ? (
            <Panel title="Product limits">
              <ItemList items={doc.limits} />
            </Panel>
          ) : null}

          {active === "gaps" ? (
            <Panel title="Known gaps">
              <ItemList items={doc.gaps} tone="warn" />
            </Panel>
          ) : null}

          {current ? <SectionCard section={current} /> : null}
        </Box>
      </Box>
    </Box>
  );
}

function SectionCard({ section }: { section: DocSection }) {
  return (
    <Panel title={section.title}>
      <ItemList items={section.items} />
    </Panel>
  );
}

function ItemList({ items, tone = "off" }: { items: { title: string; detail: string; note?: string }[]; tone?: "off" | "warn" }) {
  return (
    <Box sx={{ display: "grid", gap: 1.2 }}>
      {items.map((item) => (
        <Box
          key={item.title}
          sx={{
            display: "grid",
            gap: 0.35,
            pb: 1.2,
            borderBottom: "1px solid",
            borderColor: "divider",
            "&:last-child": { borderBottom: 0, pb: 0 },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: 650, fontSize: 14 }}>{item.title}</Typography>
            {tone === "warn" ? <Pill tone="warn">Gap</Pill> : null}
          </Box>
          <Typography color="text.secondary" sx={{ fontSize: 13.5, lineHeight: 1.5 }}>
            {item.detail}
          </Typography>
          {item.note ? (
            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{item.note}</Typography>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ p: 2.5, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper", display: "grid", gap: 1.4 }}>
      <Typography variant="h3">{title}</Typography>
      {children}
    </Box>
  );
}

function NavButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        textAlign: "left",
        border: 0,
        borderRadius: "6px",
        px: 1.1,
        py: 0.85,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: active ? 650 : 500,
        bgcolor: active ? "action.selected" : "transparent",
        color: active ? "text.primary" : "text.secondary",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      {label}
    </Box>
  );
}
