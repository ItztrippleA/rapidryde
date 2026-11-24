"use client";

import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { motion } from "framer-motion";
import NextLink from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/access/Gate";
import { Bars, ChartCard, Donut } from "@/components/charts/Charts";
import { PageHeader } from "@/components/ui/Chrome";
import type { Section } from "@/lib/access";
import { adminLogin, api, hasApi } from "@/lib/api";
import { naira, titleCase } from "@/lib/format";
import { sumBy, tally } from "@/lib/series";
import { useAdminStore } from "@/store/useAdminStore";

type LiveDriver = {
  driverId: string;
  name: string;
  online: boolean;
  status: string;
  city?: string | null;
};

type AppRow = {
  id: string;
  name: string;
  applicationStatus: string;
  accountStatus: string;
  ninStatus: string;
};

type RideRow = {
  id: string;
  status: string;
  classId?: string;
  classLabel?: string;
  fare: number;
  city?: string;
};

type SupportThread = {
  id: string;
  status: string;
};

type CustomerRow = {
  id: string;
  name: string;
  status: string;
  rideSpend?: number;
  wallet?: number;
};

export function DashboardView() {
  const classes = useAdminStore((state) => state.pricing.classes);
  const { canView } = useSession();
  const className = (id: string) => classes.find((item) => item.id === id)?.label ?? titleCase(id);

  const [loading, setLoading] = useState(hasApi());
  const [error, setError] = useState("");
  const [liveDrivers, setLiveDrivers] = useState<LiveDriver[]>([]);
  const [applications, setApplications] = useState<AppRow[]>([]);
  const [rides, setRides] = useState<RideRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [chats, setChats] = useState<SupportThread[]>([]);
  const [looking, setLooking] = useState(0);

  const load = useCallback(async () => {
    if (!hasApi()) {
      setLoading(false);
      setError("API URL is not configured.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { token } = await adminLogin();
      const [drivers, apps, sessions, people, support, demand] = await Promise.all([
        api<LiveDriver[]>("/admin/drivers/live?onlineOnly=false", { token }).catch(() => [] as LiveDriver[]),
        api<AppRow[]>("/admin/drivers/applications?limit=300", { token }).catch(() => [] as AppRow[]),
        api<RideRow[]>("/rides?limit=100", { token }).catch(() => [] as RideRow[]),
        api<CustomerRow[]>("/admin/customers?limit=300", { token }).catch(() => [] as CustomerRow[]),
        api<SupportThread[]>("/admin/support", { token }).catch(() => [] as SupportThread[]),
        api<unknown[]>("/admin/rides/looking", { token }).catch(() => [] as unknown[]),
      ]);
      setLiveDrivers(drivers);
      setApplications(apps);
      setRides(sessions);
      setCustomers(people);
      setChats(support);
      setLooking(demand.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const online = liveDrivers.filter((driver) => driver.online).length;
  const pendingApps = applications.filter(
    (row) => row.applicationStatus === "under_review" || row.applicationStatus === "draft",
  ).length;
  const liveRides = rides.filter(
    (ride) => ride.status === "on_trip" || ride.status === "assigned" || ride.status === "searching",
  ).length;
  const waitingChats = chats.filter((thread) => thread.status === "waiting").length;
  const activeCustomers = customers.filter((customer) => customer.status === "active").length;
  const rideSpend = customers.reduce((sum, customer) => sum + (customer.rideSpend || 0), 0);
  const wallets = customers.reduce((sum, customer) => sum + (customer.wallet || 0), 0);
  const completedFare = rides
    .filter((ride) => ride.status === "completed")
    .reduce((sum, ride) => sum + (ride.fare || 0), 0);

  const cards = (
    [
      {
        label: "Drivers online",
        value: String(online),
        href: "/map",
        note: `${liveDrivers.length} on the board · ${pendingApps} apps to review`,
        section: "map" as Section,
      },
      {
        label: "Customers",
        value: String(activeCustomers),
        href: "/customers",
        note: `${customers.length} accounts`,
        section: "customers" as Section,
      },
      {
        label: "Searching now",
        value: String(looking),
        href: "/map",
        note: "Open requests waiting for a driver",
        section: "map" as Section,
      },
      {
        label: "Live rides",
        value: String(liveRides),
        href: "/rides",
        note: `${rides.length} recent sessions`,
        section: "rides" as Section,
      },
      {
        label: "Completed fare (desk)",
        value: naira(completedFare),
        href: "/rides",
        note: "From loaded ride sessions",
        section: "rides" as Section,
      },
      {
        label: "Customer spend",
        value: naira(rideSpend),
        href: "/customers",
        note: wallets ? `Wallets hold ${naira(wallets)}` : "From customer records",
        section: "customers" as Section,
      },
      {
        label: "Chats waiting",
        value: String(waitingChats),
        href: "/support",
        note: `${chats.length} threads`,
        section: "support" as Section,
      },
    ] as { label: string; value: string; href: string; note: string; section: Section }[]
  ).filter((card) => canView(card.section));

  const rideStatusRows = useMemo(
    () => tally(rides, ["searching", "assigned", "on_trip", "completed", "cancelled"], (ride) => ride.status),
    [rides],
  );
  const fareByClass = useMemo(
    () =>
      sumBy(
        rides,
        classes.map((item) => item.id),
        (ride) => ride.classId || "ryde",
        (ride) => ride.fare || 0,
        className,
      ).map((row) => ({ ...row, display: naira(row.value) })),
    [rides, classes],
  );
  const driverStatusRows = useMemo(
    () =>
      tally(
        liveDrivers,
        ["available", "on_trip", "busy", "offline"],
        (driver) => (driver.online ? driver.status || "available" : "offline"),
      ),
    [liveDrivers],
  );
  const appStatusRows = useMemo(
    () =>
      tally(
        applications,
        ["draft", "under_review", "approved", "rejected"],
        (row) => row.applicationStatus || "draft",
      ),
    [applications],
  );
  const chatRows = useMemo(
    () => tally(chats, ["waiting", "open", "closed"], (thread) => thread.status),
    [chats],
  );

  return (
    <Box>
      <PageHeader
        kicker="Overview"
        title="Overview"
        lede="Live figures from the API — fleet presence, applications, rides, customers, and support."
        action={
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button startIcon={<RefreshOutlinedIcon />} onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
            {canView("analytics") ? (
              <Button component={NextLink} href="/analytics" variant="contained">
                Analytics
              </Button>
            ) : null}
          </Box>
        }
      />
      {error ? (
        <Typography color="error" sx={{ mb: 1.5, fontSize: 13 }}>
          {error}
        </Typography>
      ) : null}
      {loading ? (
        <Typography color="text.secondary" sx={{ mb: 1.5, fontSize: 13 }}>
          Loading live overview…
        </Typography>
      ) : null}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" }, gap: 1.5 }}>
        {cards.map((card, index) => (
          <Box
            key={card.label}
            component={motion.div}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.28 }}
          >
            <Box
              component={NextLink}
              href={card.href}
              sx={{
                display: "block",
                textDecoration: "none",
                color: "inherit",
                p: 2,
                borderRadius: "8px",
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                height: "100%",
                "&:hover": { borderColor: "text.primary" },
              }}
            >
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "text.secondary",
                }}
              >
                {card.label}
              </Typography>
              <Typography variant="h2" sx={{ mt: 1, fontSize: "1.45rem" }}>
                {card.value}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: 13 }}>
                {card.note}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
        {canView("rides") ? (
          <ChartCard title="Rides on the desk" note={rides.length ? undefined : "No sessions loaded yet."}>
            <Donut rows={rideStatusRows} />
          </ChartCard>
        ) : null}
        {canView("rides") ? (
          <ChartCard title="Fare by class">
            <Bars rows={fareByClass} />
          </ChartCard>
        ) : null}
        {canView("drivers") || canView("map") ? (
          <ChartCard title="Fleet duty" note="From live presence.">
            <Donut rows={driverStatusRows} />
          </ChartCard>
        ) : null}
        {canView("drivers") ? (
          <ChartCard title="Driver applications">
            <Donut rows={appStatusRows} />
          </ChartCard>
        ) : null}
        {canView("support") ? (
          <ChartCard title="Support chats">
            <Donut rows={chatRows} />
          </ChartCard>
        ) : null}
      </Box>
      <Box sx={{ mt: 3, p: 2.5, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
        <Typography variant="h3">Desk status</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, fontSize: 14 }}>
          {loading
            ? "Refreshing…"
            : online || looking || liveRides || waitingChats
              ? `${online} driver${online === 1 ? "" : "s"} online · ${looking} searching · ${liveRides} live ride${liveRides === 1 ? "" : "s"} · ${waitingChats} chat${waitingChats === 1 ? "" : "s"} waiting.`
              : "Nothing moving yet. When drivers go online or riders search, they show up here."}
        </Typography>
      </Box>
    </Box>
  );
}
