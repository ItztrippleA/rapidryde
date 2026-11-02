"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { motion } from "framer-motion";
import NextLink from "next/link";
import { useSession } from "@/components/access/Gate";
import { PageHeader } from "@/components/ui/Chrome";
import type { Section } from "@/lib/access";
import { naira } from "@/lib/format";
import { useAdminStore } from "@/store/useAdminStore";

export function DashboardView() {
  const drivers = useAdminStore((state) => state.drivers);
  const customers = useAdminStore((state) => state.customers);
  const rides = useAdminStore((state) => state.rides);
  const deliveries = useAdminStore((state) => state.deliveries);
  const activity = useAdminStore((state) => state.activity);
  const waitingChats = useAdminStore((state) => state.chats.filter((thread) => thread.status === "waiting").length);
  const online = drivers.filter((driver) => driver.online).length;
  const liveRides = rides.filter((ride) => ride.status === "on_trip" || ride.status === "assigned" || ride.status === "searching").length;
  const openDeliveries = deliveries.filter((delivery) => delivery.status !== "delivered" && delivery.status !== "cancelled").length;
  const earnings = drivers.reduce((sum, driver) => sum + driver.earningsToday, 0);
  const rideSpend = customers.reduce((sum, customer) => sum + (customer.rideSpend || 0), 0);
  const wallets = customers.reduce((sum, customer) => sum + (customer.wallet || 0), 0);
  const { canView } = useSession();

  const cards = (
    [
      { label: "Drivers online", value: String(online), href: "/map", note: `${drivers.length} on the roster`, section: "map" },
      { label: "Customers", value: String(customers.filter((customer) => customer.status === "active").length), href: "/customers", note: `${customers.length} accounts`, section: "customers" },
      { label: "Customer ride spend", value: naira(rideSpend), href: "/customers", note: `Wallets hold ${naira(wallets)}`, section: "customers" },
      { label: "Live rides", value: String(liveRides), href: "/rides", note: "Searching, assigned, or moving", section: "rides" },
      { label: "Open deliveries", value: String(openDeliveries), href: "/deliveries", note: "Parcels, meals, and loads", section: "deliveries" },
      { label: "Driver earnings today", value: naira(earnings), href: "/pricing", note: "Gross, before fuel", section: "pricing" },
      { label: "Chats waiting", value: String(waitingChats), href: "/support", note: "Drivers and customers", section: "support" },
    ] as { label: string; value: string; href: string; note: string; section: Section }[]
  ).filter((card) => canView(card.section));

  return (
    <Box>
      <PageHeader kicker="Overview" title="Overview" lede="What is moving in Abuja and Lagos right now. Cards follow the desks this role can open." />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" }, gap: 1.5 }}>
        {cards.map((card, index) => (
          <Box
            key={card.label}
            component={motion.div}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.28 }}
          >
            <Box component={NextLink} href={card.href} sx={{ display: "block", textDecoration: "none", color: "inherit", p: 2, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper", height: "100%", "&:hover": { borderColor: "text.primary" } }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>{card.label}</Typography>
              <Typography variant="h2" sx={{ mt: 1, fontSize: "1.45rem" }}>{card.value}</Typography>
              <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: 13 }}>{card.note}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 3, p: 2.5, borderRadius: "8px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
        <Typography variant="h3">Latest on the desk</Typography>
        <Box sx={{ mt: 1.5, display: "grid", gap: 1.2 }}>
          {activity.map((item) => (
            <Box key={item.id} sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: { xs: 0.2, sm: 2 }, alignItems: { sm: "baseline" } }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", minWidth: { sm: 108 } }}>{item.at}</Typography>
              <Typography>{item.text}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
