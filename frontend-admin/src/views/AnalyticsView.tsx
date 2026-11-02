"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useSession } from "@/components/access/Gate";
import { Bars, ChartCard, Donut } from "@/components/charts/Charts";
import { PageHeader } from "@/components/ui/Chrome";
import { cityLabel, naira, titleCase } from "@/lib/format";
import { sumBy, tally, type Point } from "@/lib/series";
import { useAdminStore } from "@/store/useAdminStore";

const rideStatuses = ["searching", "assigned", "on_trip", "completed", "cancelled"] as const;
const deliveryStatuses = ["new", "assigned", "picked_up", "delivered", "cancelled"] as const;
const accountStatuses = ["active", "pending", "suspended", "closed"] as const;
const ninStatuses = ["verified", "pending", "failed"] as const;

function money(rows: Point[]) {
  return rows.map((row) => ({ ...row, display: naira(row.value) }));
}

function Block({ title, show, children }: { title: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h3" sx={{ mb: 1.5 }}>{title}</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>{children}</Box>
    </Box>
  );
}

export function AnalyticsView() {
  const { canView } = useSession();
  const drivers = useAdminStore((state) => state.drivers);
  const customers = useAdminStore((state) => state.customers);
  const rides = useAdminStore((state) => state.rides);
  const deliveries = useAdminStore((state) => state.deliveries);
  const rideZones = useAdminStore((state) => state.rideZones);
  const deliveryZones = useAdminStore((state) => state.deliveryZones);
  const plans = useAdminStore((state) => state.plans);
  const subscriptions = useAdminStore((state) => state.subscriptions);
  const promos = useAdminStore((state) => state.promos);
  const chats = useAdminStore((state) => state.chats);
  const templates = useAdminStore((state) => state.templates);
  const outbox = useAdminStore((state) => state.outbox);
  const pricing = useAdminStore((state) => state.pricing);
  const className = (id: string) => pricing.classes.find((item) => item.id === id)?.label ?? titleCase(id);
  const place = (key: string) => cityLabel(key === "lagos" ? "lagos" : "abuja");
  const completedFare = rides.filter((ride) => ride.status === "completed").reduce((sum, ride) => sum + ride.fare, 0);
  const liveFare = rides.filter((ride) => ride.status === "on_trip" || ride.status === "assigned" || ride.status === "searching").reduce((sum, ride) => sum + ride.fare, 0);

  return (
    <Box>
      <PageHeader kicker="Overview" title="Analytics" lede="Figures drawn from the desks: fleet, customers, rides, deliveries, zones, subscriptions, promos, support, and notifications. A chart appears only when this role can open that desk." />

      <Block title="Fleet" show={canView("drivers")}>
        <ChartCard title="On the road" note="Online against the roster.">
          <Donut rows={[{ label: "Online", value: drivers.filter((driver) => driver.online).length }, { label: "Offline", value: drivers.filter((driver) => !driver.online).length }]} />
        </ChartCard>
        <ChartCard title="Drivers by city">
          <Bars rows={tally(drivers, ["abuja", "lagos"], (driver) => driver.city, place)} />
        </ChartCard>
        <ChartCard title="Account and papers">
          <Bars rows={[...tally(drivers, accountStatuses, (driver) => driver.status), ...tally(drivers, ["valid", "expiring", "expired"], (driver) => driver.papers)]} />
        </ChartCard>
        <ChartCard title="Class and NIN">
          <Bars rows={[...tally(drivers, pricing.classes.map((item) => item.id), (driver) => driver.classId, className), ...tally(drivers, ninStatuses, (driver) => driver.ninStatus)]} />
        </ChartCard>
        <ChartCard title="Earnings today" note="Gross, before fuel." wide>
          <Bars rows={money([...drivers].sort((a, b) => b.earningsToday - a.earningsToday).map((driver) => ({ label: driver.name, value: driver.earningsToday })))} />
        </ChartCard>
      </Block>

      <Block title="Customers" show={canView("customers")}>
        <ChartCard title="Accounts">
          <Donut rows={tally(customers, accountStatuses, (customer) => customer.status)} />
        </ChartCard>
        <ChartCard title="City and NIN">
          <Bars rows={[...tally(customers, ["abuja", "lagos"], (customer) => customer.city, place), ...tally(customers, ninStatuses, (customer) => customer.ninStatus)]} />
        </ChartCard>
        <ChartCard title="Ride spend" note="Completed fares so far, including trips that have left the desk.">
          <Bars rows={money([...customers].sort((a, b) => (b.rideSpend || 0) - (a.rideSpend || 0)).map((customer) => ({ label: customer.name, value: customer.rideSpend || 0 })))} />
        </ChartCard>
        <ChartCard title="Wallets" note={`Held in total ${naira(customers.reduce((sum, customer) => sum + (customer.wallet || 0), 0))}.`}>
          <Bars rows={money([...customers].sort((a, b) => (b.wallet || 0) - (a.wallet || 0)).map((customer) => ({ label: customer.name, value: customer.wallet || 0 })))} />
        </ChartCard>
      </Block>

      <Block title="Rides" show={canView("rides")}>
        <ChartCard title="Trip status">
          <Donut rows={tally(rides, rideStatuses, (ride) => ride.status)} />
        </ChartCard>
        <ChartCard title="Fares on the desk" note={`Completed ${naira(completedFare)}. Still open ${naira(liveFare)}.`}>
          <Bars rows={money(sumBy(rides, rideStatuses, (ride) => ride.status, (ride) => ride.fare))} />
        </ChartCard>
        <ChartCard title="Class mix">
          <Bars rows={tally(rides, pricing.classes.map((item) => item.id), (ride) => ride.classId, className)} />
        </ChartCard>
        <ChartCard title="Distance by city" note="Kilometres on the rides still on the desk.">
          <Bars rows={sumBy(rides, ["abuja", "lagos"], (ride) => ride.city, (ride) => ride.distanceKm, place).map((row) => ({ ...row, display: `${row.value.toFixed(1)} km` }))} />
        </ChartCard>
      </Block>

      <Block title="Deliveries" show={canView("deliveries")}>
        <ChartCard title="Order status">
          <Donut rows={tally(deliveries, deliveryStatuses, (delivery) => delivery.status)} />
        </ChartCard>
        <ChartCard title="Kind and fees">
          <Bars rows={money(sumBy(deliveries, ["courier", "freight", "food", "grocery"], (delivery) => delivery.kind, (delivery) => delivery.fee))} />
        </ChartCard>
      </Block>

      <Block title="Coverage" show={canView("zones")}>
        <ChartCard title="Ride zones" note="Surge on each live zone.">
          <Bars rows={rideZones.map((zone) => ({ label: `${zone.name}${zone.active ? "" : " · off"}`, value: zone.surge, display: `${zone.surge}×` }))} />
        </ChartCard>
        <ChartCard title="Delivery zones" note="Base fee on each zone.">
          <Bars rows={money(deliveryZones.map((zone) => ({ label: `${zone.name}${zone.active ? "" : " · off"}`, value: zone.fee })))} />
        </ChartCard>
      </Block>

      <Block title="Commercial" show={canView("pricing") || canView("subscriptions") || canView("promos")}>
        {canView("pricing") ? (
          <ChartCard title="Class multipliers" note={`Commission ${pricing.commissionPercent}% of a completed fare is ${naira(Math.round(completedFare * pricing.commissionPercent / 100))} on the rides still marked completed.`}>
            <Bars rows={pricing.classes.map((item) => ({ label: item.label, value: item.multiplier, display: `${item.multiplier}×` }))} />
          </ChartCard>
        ) : null}
        {canView("pricing") ? (
          <ChartCard title="Distance bands" note="Naira per kilometre.">
            <Bars rows={money(pricing.bands.map((band) => ({ label: band.label, value: band.perKm })))} />
          </ChartCard>
        ) : null}
        {canView("subscriptions") ? (
          <ChartCard title="Subscription take" note="Active records times the plan price. Week and month are not annualised.">
            <Bars rows={money(plans.map((plan) => {
              const active = subscriptions.filter((item) => item.planId === plan.id && item.status === "active").length;
              return { label: `${plan.name} · ${active} active`, value: active * plan.price, display: `${naira(active * plan.price)} / ${plan.interval}` };
            }))} />
          </ChartCard>
        ) : null}
        {canView("promos") ? (
          <ChartCard title="Promo use" note="Codes claimed against the cap.">
            <Bars rows={promos.map((promo) => ({ label: promo.code, value: promo.uses, display: `${promo.uses} / ${promo.maxUses}${promo.active ? "" : " · off"}` }))} />
          </ChartCard>
        ) : null}
      </Block>

      <Block title="Support and messages" show={canView("support") || canView("notifications")}>
        {canView("support") ? (
          <ChartCard title="Chat status" note="Waiting means the last word is theirs.">
            <Donut rows={tally(chats, ["waiting", "open", "closed"], (thread) => thread.status)} />
          </ChartCard>
        ) : null}
        {canView("support") ? (
          <ChartCard title="Who is writing">
            <Bars rows={tally(chats, ["driver", "customer"], (thread) => thread.party)} />
          </ChartCard>
        ) : null}
        {canView("notifications") ? (
          <ChartCard title="Templates and outbox">
            <Bars rows={[...tally(templates, ["email", "native"], (template) => template.channel, (key) => `${titleCase(key)} templates`), ...tally(outbox, ["email", "native"], (item) => item.channel, (key) => `${titleCase(key)} queued`)]} />
          </ChartCard>
        ) : null}
      </Block>
    </Box>
  );
}
