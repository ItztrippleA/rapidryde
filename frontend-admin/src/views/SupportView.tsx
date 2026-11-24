"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEdit, useSession } from "@/components/access/Gate";
import { PageHeader, Pill } from "@/components/ui/Chrome";
import { adminLogin, api, hasApi } from "@/lib/api";
import { ago, titleCase } from "@/lib/format";
import type { ChatParty, ChatStatus } from "@/lib/types";

type LiveMessage = {
  id: string;
  from: "party" | "staff";
  author: string;
  body: string;
  at: number;
};

type LiveThread = {
  id: string;
  party: ChatParty;
  partyId: string;
  partyName: string;
  partyPhone: string;
  city: string;
  subject: string;
  status: ChatStatus;
  messages: LiveMessage[];
  updatedAt: number;
};

const parties: Array<ChatParty | "all"> = ["all", "driver", "customer"];
const statuses: Array<ChatStatus | "all"> = ["all", "waiting", "open", "closed"];

export function SupportView() {
  const edit = useEdit();
  const { person } = useSession();
  const searchParams = useSearchParams();
  const threadFromUrl = searchParams.get("thread");
  const [threads, setThreads] = useState<LiveThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [party, setParty] = useState<ChatParty | "all">("all");
  const [status, setStatus] = useState<ChatStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(threadFromUrl);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (threadFromUrl) setSelectedId(threadFromUrl);
  }, [threadFromUrl]);

  const load = useCallback(async () => {
    if (!hasApi()) {
      setError("API URL is not configured.");
      setLoading(false);
      return;
    }
    try {
      const { token } = await adminLogin();
      const params = new URLSearchParams({ limit: "200" });
      if (party !== "all") params.set("party", party);
      if (status !== "all") params.set("status", status);
      const remote = await api<LiveThread[]>(`/admin/support?${params}`, { token });
      setThreads(remote);
      setError("");
      setSelectedId((current) => {
        const prefer = threadFromUrl || current;
        if (prefer && remote.some((thread) => thread.id === prefer)) return prefer;
        return remote.find((thread) => thread.status === "waiting")?.id ?? remote[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load support chats.");
    } finally {
      setLoading(false);
    }
  }, [party, status, threadFromUrl]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 6_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((thread) => {
      if (!q) return true;
      return `${thread.partyName} ${thread.partyPhone} ${thread.subject}`.toLowerCase().includes(q);
    });
  }, [threads, query]);

  const selected = threads.find((thread) => thread.id === selectedId) ?? null;
  const waiting = threads.filter((thread) => thread.status === "waiting").length;

  async function send() {
    if (!selected || !draft.trim() || !edit) return;
    setSending(true);
    setError("");
    try {
      const { token } = await adminLogin();
      const updated = await api<LiveThread>(`/admin/support/${selected.id}/messages`, {
        method: "POST",
        token,
        body: JSON.stringify({
          text: draft.trim(),
          author: person?.name || "Rapyd Ryd",
          kind: "text",
        }),
      });
      setThreads((current) => current.map((thread) => (thread.id === updated.id ? updated : thread)));
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reply.");
    } finally {
      setSending(false);
    }
  }

  async function toggleClose() {
    if (!selected || !edit) return;
    const next = selected.status === "closed" ? "open" : "closed";
    try {
      const { token } = await adminLogin();
      const updated = await api<LiveThread>(`/admin/support/${selected.id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: next }),
      });
      setThreads((current) => current.map((thread) => (thread.id === updated.id ? updated : thread)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update chat.");
    }
  }

  return (
    <Box>
      <PageHeader
        kicker="Support"
        title="Chat"
        lede="Live desk for drivers and customers. Waiting means they sent the latest message. Replies push to their app."
        action={
          <Button onClick={() => void load()} disabled={loading}>
            Refresh{waiting ? ` · ${waiting} waiting` : ""}
          </Button>
        }
      />

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
        <ToggleButtonGroup exclusive size="small" value={party} onChange={(_, value: ChatParty | "all" | null) => value && setParty(value)} sx={{ flexWrap: "wrap" }}>
          {parties.map((item) => (
            <ToggleButton key={item} value={item}>
              {item === "all" ? "Everyone" : titleCase(item) + "s"}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <ToggleButtonGroup exclusive size="small" value={status} onChange={(_, value: ChatStatus | "all" | null) => value && setStatus(value)} sx={{ flexWrap: "wrap" }}>
          {statuses.map((item) => (
            <ToggleButton key={item} value={item}>
              {titleCase(item)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField
          size="small"
          placeholder="Search name, phone, or subject"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ width: { xs: "100%", md: 260 }, ml: { md: "auto" } }}
        />
      </Box>

      {error ? (
        <Typography color="error" sx={{ mb: 1.5, fontSize: 14 }}>
          {error}
        </Typography>
      ) : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "320px minmax(0, 1fr)" }, gap: 1.5, minHeight: 520 }}>
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper", overflow: "auto", display: selected ? { xs: "none", md: "block" } : "block", maxHeight: { md: 640 } }}>
          {loading && rows.length === 0 ? <Typography color="text.secondary" sx={{ p: 2 }}>Loading chats…</Typography> : null}
          {!loading && rows.length === 0 ? <Typography color="text.secondary" sx={{ p: 2 }}>No chats in this filter.</Typography> : null}
          {rows.map((thread) => {
            const active = thread.id === selected?.id;
            return (
              <Box
                key={thread.id}
                onClick={() => setSelectedId(thread.id)}
                sx={{ px: 1.5, py: 1.3, cursor: "pointer", borderBottom: "1px solid", borderColor: "divider", bgcolor: active ? "action.selected" : "transparent", "&:hover": { bgcolor: active ? "action.selected" : "action.hover" } }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{thread.partyName || "Unknown"}</Typography>
                  <Pill tone={thread.party === "driver" ? "warn" : "ok"}>{titleCase(thread.party)}</Pill>
                  <Box sx={{ ml: "auto" }}>
                    <Pill tone={thread.status === "waiting" ? "hot" : thread.status === "open" ? "ok" : "off"}>{titleCase(thread.status)}</Pill>
                  </Box>
                </Box>
                <Typography sx={{ mt: 0.4, fontSize: 13 }}>{thread.subject || "Support"}</Typography>
                <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.3 }}>
                  {thread.city} · {ago(thread.updatedAt)}
                </Typography>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "8px", bgcolor: "background.paper", display: selected ? "flex" : { xs: "none", md: "flex" }, flexDirection: "column", minHeight: 520, maxHeight: { md: 640 } }}>
          {selected ? (
            <>
              <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider", display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <Button size="small" sx={{ display: { md: "none" } }} onClick={() => setSelectedId(null)}>
                  Back
                </Button>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>{selected.partyName || "Unknown"}</Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    {selected.partyPhone || selected.subject}
                  </Typography>
                </Box>
                {edit ? (
                  <Button size="small" color={selected.status === "closed" ? "inherit" : "error"} onClick={() => void toggleClose()}>
                    {selected.status === "closed" ? "Reopen" : "Close chat"}
                  </Button>
                ) : null}
              </Box>
              <Box sx={{ flex: 1, overflow: "auto", p: 2, display: "grid", alignContent: "start", gap: 1.2 }}>
                {selected.messages.length === 0 ? <Typography color="text.secondary">No messages yet.</Typography> : null}
                {selected.messages.map((message) => {
                  const mine = message.from === "staff";
                  return (
                    <Box key={message.id} sx={{ justifySelf: mine ? "end" : "start", maxWidth: "80%" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: "text.secondary", mb: 0.3, textAlign: mine ? "right" : "left" }}>
                        {message.author} · {ago(message.at)}
                      </Typography>
                      <Box sx={{ px: 1.4, py: 1, borderRadius: "8px", bgcolor: mine ? "primary.main" : "action.hover", color: mine ? "primary.contrastText" : "text.primary", fontSize: 14, lineHeight: 1.45 }}>
                        {message.body}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              {edit ? (
                <Box sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider", display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1, alignItems: { xs: "stretch", sm: "flex-end" } }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder={selected.status === "closed" ? "Sending will reopen this chat" : "Write a reply"}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <Button variant="contained" disabled={!draft.trim() || sending} onClick={() => void send()}>
                    Send
                  </Button>
                </Box>
              ) : null}
            </>
          ) : (
            <Typography color="text.secondary" sx={{ m: "auto", p: 3 }}>
              Choose a driver or customer chat.
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
