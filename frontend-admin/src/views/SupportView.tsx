"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";
import { useEdit, useSession } from "@/components/access/Gate";
import { Editor, PageHeader, Pill } from "@/components/ui/Chrome";
import { cityLabel, titleCase, uid } from "@/lib/format";
import type { ChatParty, ChatStatus, ChatThread } from "@/lib/types";
import { useAdminStore } from "@/store/useAdminStore";

const parties: Array<ChatParty | "all"> = ["all", "driver", "customer"];
const statuses: Array<ChatStatus | "all"> = ["all", "waiting", "open", "closed"];

export function SupportView() {
  const chats = useAdminStore((state) => state.chats);
  const drivers = useAdminStore((state) => state.drivers);
  const customers = useAdminStore((state) => state.customers);
  const startChat = useAdminStore((state) => state.startChat);
  const replyToChat = useAdminStore((state) => state.replyToChat);
  const setChatStatus = useAdminStore((state) => state.setChatStatus);
  const edit = useEdit();
  const { person } = useSession();
  const [party, setParty] = useState<ChatParty | "all">("all");
  const [status, setStatus] = useState<ChatStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(chats.find((thread) => thread.status === "waiting")?.id ?? chats[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState<ChatThread | null>(null);

  const nameOf = (thread: ChatThread) => {
    const pool = thread.party === "driver" ? drivers : customers;
    return pool.find((item) => item.id === thread.partyId)?.name ?? "Removed account";
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats.filter((thread) => {
      const pool = thread.party === "driver" ? drivers : customers;
      const name = pool.find((item) => item.id === thread.partyId)?.name ?? "";
      if (party !== "all" && thread.party !== party) return false;
      if (status !== "all" && thread.status !== status) return false;
      if (!q) return true;
      return `${name} ${thread.subject}`.toLowerCase().includes(q);
    });
  }, [chats, party, status, query, drivers, customers]);

  const selected = chats.find((thread) => thread.id === selectedId) ?? null;
  const people = creating?.party === "driver" ? drivers : customers;

  const send = () => {
    if (!selected || !draft.trim() || !person) return;
    replyToChat(selected.id, { id: uid("m"), from: "staff", author: person.name, body: draft.trim(), at: "Just now" });
    setDraft("");
  };

  return (
    <Box>
      <PageHeader
        kicker="Support"
        title="Chat"
        lede="One desk for drivers and customers. A waiting chat is the latest message from them. Replies stay on this console until the apps are connected."
        action={edit ? <Button variant="contained" onClick={() => setCreating({ id: uid("ch"), party: "customer", partyId: customers[0]?.id ?? "", subject: "", status: "open", city: customers[0]?.city ?? "abuja", updatedAt: "Just now", messages: [] })}>New chat</Button> : null}
      />
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
        <ToggleButtonGroup exclusive size="small" value={party} onChange={(_, value: ChatParty | "all" | null) => value && setParty(value)} sx={{ flexWrap: "wrap" }}>
          {parties.map((item) => <ToggleButton key={item} value={item}>{item === "all" ? "Everyone" : titleCase(item) + "s"}</ToggleButton>)}
        </ToggleButtonGroup>
        <ToggleButtonGroup exclusive size="small" value={status} onChange={(_, value: ChatStatus | "all" | null) => value && setStatus(value)} sx={{ flexWrap: "wrap" }}>
          {statuses.map((item) => <ToggleButton key={item} value={item}>{titleCase(item)}</ToggleButton>)}
        </ToggleButtonGroup>
        <TextField size="small" placeholder="Search name or subject" value={query} onChange={(event) => setQuery(event.target.value)} sx={{ width: { xs: "100%", md: 240 }, ml: { md: "auto" } }} />
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "320px minmax(0, 1fr)" }, gap: 1.5, minHeight: 520 }}>
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper", overflow: "auto", display: selected ? { xs: "none", md: "block" } : "block", maxHeight: { md: 640 } }}>
          {rows.length === 0 ? <Typography color="text.secondary" sx={{ p: 2 }}>No chats in this filter.</Typography> : null}
          {rows.map((thread) => {
            const active = thread.id === selected?.id;
            return (
              <Box
                key={thread.id}
                onClick={() => setSelectedId(thread.id)}
                sx={{ px: 1.5, py: 1.3, cursor: "pointer", borderBottom: "1px solid", borderColor: "divider", bgcolor: active ? "action.selected" : "transparent", "&:hover": { bgcolor: active ? "action.selected" : "action.hover" } }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{nameOf(thread)}</Typography>
                  <Pill tone={thread.party === "driver" ? "warn" : "ok"}>{titleCase(thread.party)}</Pill>
                  <Box sx={{ ml: "auto" }}><Pill tone={thread.status === "waiting" ? "hot" : thread.status === "open" ? "ok" : "off"}>{titleCase(thread.status)}</Pill></Box>
                </Box>
                <Typography sx={{ mt: 0.4, fontSize: 13 }}>{thread.subject}</Typography>
                <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.3 }}>{cityLabel(thread.city)} · {thread.updatedAt}</Typography>
              </Box>
            );
          })}
        </Box>
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper", display: selected ? "flex" : { xs: "none", md: "flex" }, flexDirection: "column", minHeight: 520, maxHeight: { md: 640 } }}>
          {selected ? (
            <>
              <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider", display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <Button size="small" sx={{ display: { md: "none" } }} onClick={() => setSelectedId(null)}>Back</Button>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>{nameOf(selected)}</Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>{selected.subject}</Typography>
                </Box>
                {edit ? (
                  <Button size="small" color={selected.status === "closed" ? "inherit" : "error"} onClick={() => setChatStatus(selected.id, selected.status === "closed" ? "open" : "closed")}>
                    {selected.status === "closed" ? "Reopen" : "Close chat"}
                  </Button>
                ) : null}
              </Box>
              <Box sx={{ flex: 1, overflow: "auto", p: 2, display: "grid", alignContent: "start", gap: 1.2 }}>
                {selected.messages.map((message) => {
                  const mine = message.from === "staff";
                  return (
                    <Box key={message.id} sx={{ justifySelf: mine ? "end" : "start", maxWidth: "80%" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary", mb: 0.3, textAlign: mine ? "right" : "left" }}>{message.author} · {message.at}</Typography>
                      <Box sx={{ px: 1.4, py: 1, borderRadius: "8px", bgcolor: mine ? "primary.main" : "action.hover", color: mine ? "primary.contrastText" : "text.primary", fontSize: 14, lineHeight: 1.45 }}>{message.body}</Box>
                    </Box>
                  );
                })}
              </Box>
              {edit ? (
                <Box sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider", display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1, alignItems: { xs: "stretch", sm: "flex-end" } }}>
                  <TextField fullWidth multiline minRows={2} placeholder={selected.status === "closed" ? "Reopening happens when you send" : "Write a reply"} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} />
                  <Button variant="contained" disabled={!draft.trim()} onClick={send}>Send</Button>
                </Box>
              ) : null}
            </>
          ) : (
            <Typography color="text.secondary" sx={{ m: "auto", p: 3 }}>Choose a driver or customer chat.</Typography>
          )}
        </Box>
      </Box>
      <Editor
        open={Boolean(creating)}
        title="New chat"
        saveLabel="Open chat"
        onClose={() => setCreating(null)}
        onSave={() => {
          if (!creating || !creating.subject.trim() || !creating.partyId || !person) return;
          const contact = (creating.party === "driver" ? drivers : customers).find((item) => item.id === creating.partyId);
          const thread: ChatThread = {
            ...creating,
            subject: creating.subject.trim(),
            city: contact?.city ?? creating.city,
            messages: [{ id: uid("m"), from: "staff", author: person.name, body: creating.messages[0]?.body.trim() || creating.subject.trim(), at: "Just now" }],
          };
          startChat(thread);
          setSelectedId(thread.id);
          setCreating(null);
        }}
      >
        {creating ? (
          <>
            <TextField select label="Who" value={creating.party} onChange={(event) => {
              const next = event.target.value as ChatParty;
              const pool = next === "driver" ? drivers : customers;
              setCreating({ ...creating, party: next, partyId: pool[0]?.id ?? "", city: pool[0]?.city ?? "abuja" });
            }}>
              <MenuItem value="driver">Driver</MenuItem>
              <MenuItem value="customer">Customer</MenuItem>
            </TextField>
            <TextField select label="Account" value={creating.partyId} onChange={(event) => setCreating({ ...creating, partyId: event.target.value })}>
              {people.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
            </TextField>
            <TextField label="Subject" value={creating.subject} onChange={(event) => setCreating({ ...creating, subject: event.target.value })} />
            <TextField label="First message" multiline minRows={3} value={creating.messages[0]?.body ?? ""} onChange={(event) => setCreating({ ...creating, messages: [{ id: "draft", from: "staff", author: person?.name ?? "Staff", body: event.target.value, at: "Just now" }] })} />
          </>
        ) : null}
      </Editor>
    </Box>
  );
}
