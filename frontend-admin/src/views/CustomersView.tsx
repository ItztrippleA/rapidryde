"use client";

import ChatOutlinedIcon from "@mui/icons-material/ChatOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/access/Gate";
import { PageHeader, Pill } from "@/components/ui/Chrome";
import { adminLogin, api, hasApi } from "@/lib/api";
import { cityLabel, naira, titleCase } from "@/lib/format";
import { labelOf, RideDetailDialog, type SessionRow, whenOf } from "@/views/RidesView";

type CustomerRow = {
  id: string;
  code: string | null;
  name: string;
  phone: string;
  email: string;
  city: string;
  ninStatus: string;
  identityStatus?: string;
  maskedNin?: string | null;
  status: string;
  rating: number;
  trips: number;
  wallet: number;
  rideSpend: number;
  joined: string;
};

function accountTone(status: string): "ok" | "warn" | "hot" | "off" {
  if (status === "active") return "ok";
  if (status === "pending") return "warn";
  if (status === "suspended") return "hot";
  return "off";
}

function placeLabel(city: string) {
  if (city === "abuja" || city === "lagos") return cityLabel(city);
  return titleCase(city || "—");
}

function DetailLine({ label, value }: { label: string; value?: string | number | null }) {
  const text = value == null || value === "" ? "—" : String(value);
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 0.6, borderBottom: "1px solid", borderColor: "divider" }}>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 600, textAlign: "right" }}>{text}</Typography>
    </Box>
  );
}

export function CustomersView() {
  const router = useRouter();
  const { canView } = useSession();
  const canChat = canView("support");
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(hasApi());
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customerRides, setCustomerRides] = useState<SessionRow[]>([]);
  const [ridesLoading, setRidesLoading] = useState(false);
  const [rideDetail, setRideDetail] = useState<SessionRow | null>(null);
  const [openingChatId, setOpeningChatId] = useState<string | null>(null);

  const openChat = useCallback(
    async (customer: CustomerRow) => {
      if (!canChat || !hasApi()) return;
      setOpeningChatId(customer.id);
      setError("");
      try {
        const { token } = await adminLogin();
        const thread = await api<{ id: string }>("/admin/support/open", {
          method: "POST",
          token,
          body: JSON.stringify({
            party: "customer",
            partyId: customer.id,
            subject: `Chat with ${customer.name}`,
          }),
        });
        router.push(`/support?thread=${encodeURIComponent(thread.id)}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not open chat.");
      } finally {
        setOpeningChatId(null);
      }
    },
    [canChat, router],
  );

  const load = useCallback(async () => {
    if (!hasApi()) {
      setError("API URL is not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { token } = await adminLogin();
      const remote = await api<CustomerRow[]>("/admin/customers?limit=300", { token });
      setRows(remote);
      setSelectedId((current) => {
        if (current && remote.some((row) => row.id === current)) return current;
        return remote[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load customers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setCustomerRides([]);
      setRideDetail(null);
      return;
    }
    let cancelled = false;
    setRidesLoading(true);
    setCustomerRides([]);
    setRideDetail(null);
    void (async () => {
      if (!hasApi()) {
        if (!cancelled) setRidesLoading(false);
        return;
      }
      try {
        const { token } = await adminLogin();
        const rides = await api<SessionRow[]>(
          `/rides?customerId=${encodeURIComponent(selected.id)}&limit=50`,
          { token },
        );
        if (!cancelled) setCustomerRides(rides);
      } catch {
        if (!cancelled) setCustomerRides([]);
      } finally {
        if (!cancelled) setRidesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((customer) =>
      `${customer.name} ${customer.phone} ${customer.email} ${customer.code || ""} ${customer.city}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  const walletTotal = rows.reduce((sum, customer) => sum + (customer.wallet || 0), 0);
  const spendTotal = rows.reduce((sum, customer) => sum + (customer.rideSpend || 0), 0);

  return (
    <Box>
      <PageHeader
        kicker="People"
        title="Customers"
        lede="Accounts from the API. Click a customer to see details and ride history."
        action={
          <Button startIcon={<RefreshOutlinedIcon />} onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        }
      />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, mb: 2 }}>
        <Box sx={{ p: 2, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>
            Accounts
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.6 }}>
            {rows.length}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            {rows.filter((row) => row.status === "active").length} active
          </Typography>
        </Box>
        <Box sx={{ p: 2, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>
            Wallets / spend
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.6 }}>
            {naira(walletTotal)}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13 }}>
            Ride spend tracked {naira(spendTotal)}
          </Typography>
        </Box>
      </Box>
      {error ? (
        <Typography color="error" sx={{ mb: 1.5, fontSize: 13 }}>
          {error}
        </Typography>
      ) : null}
      <TextField
        size="small"
        label="Search customers"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        sx={{ mb: 2, width: { xs: "100%", sm: 320 } }}
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "340px minmax(0, 1fr)" }, gap: 1.5, minHeight: 520 }}>
        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "8px",
            bgcolor: "background.paper",
            overflow: "auto",
            maxHeight: { md: 640 },
            display: selected ? { xs: "none", md: "block" } : "block",
          }}
        >
          {loading && filtered.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              Loading customers…
            </Typography>
          ) : null}
          {!loading && filtered.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              No customers yet.
            </Typography>
          ) : null}
          {filtered.map((customer) => {
            const active = customer.id === selected?.id;
            const chatting = openingChatId === customer.id;
            return (
              <Box
                key={customer.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(customer.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId(customer.id);
                  }
                }}
                sx={{
                  px: 1.5,
                  py: 1.3,
                  cursor: "pointer",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  bgcolor: active ? "action.selected" : "transparent",
                  "&:hover": { bgcolor: active ? "action.selected" : "action.hover" },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{customer.name}</Typography>
                      <Pill tone={accountTone(customer.status)}>{titleCase(customer.status)}</Pill>
                    </Box>
                    <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.35 }}>
                      {customer.code || customer.id} · {customer.phone}
                    </Typography>
                    <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.25 }}>
                      {placeLabel(customer.city)} · {naira(customer.rideSpend || 0)} spent
                    </Typography>
                  </Box>
                  {canChat ? (
                    <Tooltip title="Chat with customer">
                      <IconButton
                        size="small"
                        aria-label={`Chat with ${customer.name}`}
                        disabled={chatting}
                        onClick={(event) => {
                          event.stopPropagation();
                          void openChat(customer);
                        }}
                      >
                        {chatting ? <CircularProgress size={16} /> : <ChatOutlinedIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "8px",
            bgcolor: "background.paper",
            display: selected ? "flex" : { xs: "none", md: "flex" },
            flexDirection: "column",
            minHeight: 520,
            maxHeight: { md: 640 },
            overflow: "hidden",
          }}
        >
          {selected ? (
            <>
              <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider", display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <Button size="small" sx={{ display: { md: "none" } }} onClick={() => setSelectedId(null)}>
                  Back
                </Button>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>{selected.name}</Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    {selected.phone}
                    {selected.email ? ` · ${selected.email}` : ""}
                  </Typography>
                </Box>
                <Pill tone={accountTone(selected.status)}>{titleCase(selected.status)}</Pill>
                <Pill tone={selected.ninStatus === "verified" ? "ok" : selected.ninStatus === "failed" ? "hot" : "warn"}>
                  NIN {selected.identityStatus || selected.ninStatus}
                </Pill>
                {canChat ? (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={
                      openingChatId === selected.id ? <CircularProgress size={14} /> : <ChatOutlinedIcon fontSize="small" />
                    }
                    disabled={openingChatId === selected.id}
                    onClick={() => void openChat(selected)}
                  >
                    Chat
                  </Button>
                ) : null}
              </Box>

              <Box sx={{ flex: 1, overflow: "auto", p: 2, display: "grid", alignContent: "start", gap: 1.2 }}>
                <DetailLine label="Code" value={selected.code} />
                <DetailLine label="City" value={placeLabel(selected.city)} />
                <DetailLine label="Joined" value={selected.joined} />
                <DetailLine label="Rating" value={selected.rating} />
                <DetailLine label="Trips" value={selected.trips} />
                <DetailLine label="Wallet" value={naira(selected.wallet || 0)} />
                <DetailLine label="Ride spend" value={naira(selected.rideSpend || 0)} />
                <DetailLine label="Masked NIN" value={selected.maskedNin} />

                <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: "text.secondary", mt: 1.5 }}>
                  RIDE HISTORY
                </Typography>
                {ridesLoading ? (
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    Loading rides…
                  </Typography>
                ) : customerRides.length === 0 ? (
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    No rides for this customer yet.
                  </Typography>
                ) : (
                  <Box sx={{ display: "grid", gap: 0.8 }}>
                    {customerRides.map((ride) => (
                      <Box
                        key={ride.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setRideDetail(ride)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setRideDetail(ride);
                          }
                        }}
                        sx={{
                          p: 1.2,
                          borderRadius: "8px",
                          border: "1px solid",
                          borderColor: "divider",
                          cursor: "pointer",
                          "&:hover": { bgcolor: "action.hover" },
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "center" }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                            {labelOf(ride.pickup)} → {labelOf(ride.dropoff)}
                          </Typography>
                          <Pill tone={ride.status === "cancelled" ? "hot" : ride.status === "completed" ? "off" : "ok"}>
                            {titleCase(ride.status)}
                          </Pill>
                        </Box>
                        <Typography color="text.secondary" sx={{ fontSize: 12, mt: 0.4 }}>
                          {whenOf(ride)} · {naira(ride.fare)}
                          {ride.driver?.name ? ` · ${ride.driver.name}` : " · Unassigned"}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </>
          ) : (
            <Typography color="text.secondary" sx={{ m: "auto", p: 3 }}>
              Choose a customer from the list.
            </Typography>
          )}
        </Box>
      </Box>

      <RideDetailDialog ride={rideDetail} onClose={() => setRideDetail(null)} />
    </Box>
  );
}
