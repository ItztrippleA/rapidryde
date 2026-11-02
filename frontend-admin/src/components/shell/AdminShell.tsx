"use client";

import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import CardMembershipOutlinedIcon from "@mui/icons-material/CardMembershipOutlined";
import ChatOutlinedIcon from "@mui/icons-material/ChatOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import RouteOutlinedIcon from "@mui/icons-material/RouteOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { AnimatePresence, motion } from "framer-motion";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/components/access/Gate";
import { Mark } from "@/components/brand/Mark";
import { SignIn } from "@/components/shell/SignIn";
import { Pill } from "@/components/ui/Chrome";
import { roleLabel, sectionLabel, type Section } from "@/lib/access";
import { useAdminStore } from "@/store/useAdminStore";
import { useUiStore } from "@/store/useUiStore";

const groups: { label: string; items: { href: string; section: Section; label: string; icon: typeof DashboardOutlinedIcon }[] }[] = [
  { label: "Overview", items: [
    { href: "/", section: "dashboard", label: "Overview", icon: DashboardOutlinedIcon },
    { href: "/analytics", section: "analytics", label: "Analytics", icon: InsightsOutlinedIcon },
  ] },
  {
    label: "People",
    items: [
      { href: "/drivers", section: "drivers", label: "Drivers", icon: DirectionsCarOutlinedIcon },
      { href: "/customers", section: "customers", label: "Customers", icon: GroupOutlinedIcon },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/map", section: "map", label: "Fleet map", icon: MapOutlinedIcon },
      { href: "/rides", section: "rides", label: "Rides", icon: RouteOutlinedIcon },
      { href: "/deliveries", section: "deliveries", label: "Deliveries", icon: LocalShippingOutlinedIcon },
      { href: "/zones", section: "zones", label: "Zones", icon: LayersOutlinedIcon },
    ],
  },
  {
    label: "Commercial",
    items: [
      { href: "/pricing", section: "pricing", label: "Pricing", icon: PaymentsOutlinedIcon },
      { href: "/subscriptions", section: "subscriptions", label: "Subscriptions", icon: CardMembershipOutlinedIcon },
      { href: "/promos", section: "promos", label: "Promos", icon: LocalOfferOutlinedIcon },
    ],
  },
  {
    label: "Support",
    items: [
      { href: "/support", section: "support", label: "Chat", icon: ChatOutlinedIcon },
      { href: "/notifications", section: "notifications", label: "Notifications", icon: NotificationsNoneOutlinedIcon },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/config", section: "config", label: "Configuration", icon: TuneOutlinedIcon },
      { href: "/access", section: "access", label: "Access", icon: AdminPanelSettingsOutlinedIcon },
    ],
  },
];

function NavBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const mode = useTheme().palette.mode;
  const waiting = useAdminStore((state) => state.chats.filter((thread) => thread.status === "waiting").length);
  const { canView, active } = useSession();
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "background.paper" }}>
      <Box component={NextLink} href="/" aria-label="Rapyd Ryd" sx={{ px: 2, height: 64, display: "flex", alignItems: "center", textDecoration: "none", borderBottom: "1px solid", borderColor: "divider" }}>
        <Mark height={34} />
      </Box>
      <Box sx={{ p: 1.5, display: "grid", gap: 1.5, overflow: "auto" }}>
        {groups.map((group) => {
          const items = group.items.filter((item) => canView(item.section));
          if (!items.length) return null;
          return (
            <Box key={group.label}>
              <Typography sx={{ px: 1.2, mb: 0.4, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>{group.label}</Typography>
              {items.map((item) => {
                const activeItem = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Box
                    key={item.href}
                    component={NextLink}
                    href={item.href}
                    onClick={onNavigate}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      textDecoration: "none",
                      color: activeItem ? "primary.main" : "text.primary",
                      px: 1.2,
                      py: 0.8,
                      borderRadius: "8px",
                      fontSize: 14,
                      fontWeight: activeItem ? 650 : 500,
                      bgcolor: activeItem ? "action.selected" : "transparent",
                      boxShadow: activeItem ? `inset 3px 0 0 ${mode === "dark" ? "#D6F25C" : "#FF6A00"}` : "none",
                      "&:hover": { bgcolor: activeItem ? "action.selected" : "action.hover" },
                    }}
                  >
                    <Icon sx={{ fontSize: 18 }} />
                    {item.label}
                    {item.section === "support" && waiting > 0 ? (
                      <Box component="span" sx={{ ml: "auto", minWidth: 18, height: 18, px: 0.5, borderRadius: "9px", bgcolor: "primary.main", color: "primary.contrastText", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center" }}>{waiting}</Box>
                    ) : null}
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Box>
      <Typography color="text.secondary" sx={{ mt: "auto", px: 2, py: 2, fontSize: 12, borderTop: "1px solid", borderColor: "divider" }}>
        Signed in as {active ? roleLabel[active.role] : "suspended"}
      </Typography>
    </Box>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mode = useTheme().palette.mode;
  const toggleMode = useUiStore((state) => state.toggleMode);
  const navOpen = useUiStore((state) => state.navOpen);
  const setNavOpen = useUiStore((state) => state.setNavOpen);
  const setStaffId = useUiStore((state) => state.setStaffId);
  const hasHydrated = useUiStore((state) => state.hasHydrated);
  const { person, canView } = useSession();
  const [entered, setEntered] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const current = groups.flatMap((group) => group.items).find((item) => item.href === pathname);

  useEffect(() => {
    setEntered(true);
  }, []);

  if (!hasHydrated) return <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }} />;
  if (!person) return <SignIn />;

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", bgcolor: "background.default", position: "relative" }}>
      <Box aria-hidden sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 20, background: "linear-gradient(90deg, #D6F25C 0%, #FF6A00 52%, #E2B657 100%)" }} />
      <Box sx={{ width: 248, flex: "0 0 auto", display: { xs: "none", md: "block" }, borderRight: "1px solid", borderColor: "divider", position: "sticky", top: 0, height: "100vh", bgcolor: "background.paper" }}>
        <NavBody />
      </Box>
      <Drawer open={navOpen} onClose={() => setNavOpen(false)} sx={{ display: { md: "none" } }} slotProps={{ paper: { sx: { width: "min(100vw, 300px)" } } }}>
        <NavBody onNavigate={() => setNavOpen(false)} />
      </Drawer>
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Box sx={{ height: 56, px: { xs: 1.5, md: 3 }, display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid", borderColor: "divider", position: "sticky", top: 0, zIndex: 10, bgcolor: "background.paper" }}>
          <IconButton sx={{ display: { md: "none" } }} aria-label="Open navigation" onClick={() => setNavOpen(true)}>
            <MenuIcon />
          </IconButton>
          <Typography sx={{ fontWeight: 650, fontSize: 14 }}>{current ? sectionLabel[current.section] : "Admin"}</Typography>
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.5 }}>
            <IconButton aria-label={mode === "dark" ? "Switch to light" : "Switch to dark"} onClick={toggleMode}>
              {mode === "dark" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
            </IconButton>
            <Button color="inherit" onClick={(event) => setMenu(event.currentTarget)} sx={{ gap: 1, pl: 0.6 }}>
              <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: "primary.main" }}>{person?.name.slice(0, 1)}</Avatar>
              <Box sx={{ textAlign: "left", display: { xs: "none", sm: "block" } }}>
                <Typography sx={{ fontSize: 13, fontWeight: 650, lineHeight: 1.1 }}>{person?.name}</Typography>
                <Typography sx={{ fontSize: 11, color: "text.secondary", lineHeight: 1.2 }}>{person ? roleLabel[person.role] : ""}</Typography>
              </Box>
            </Button>
            <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
              <Box sx={{ px: 2, py: 1, maxWidth: 260 }}>
                <Typography sx={{ fontWeight: 700 }}>{person.name}</Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{person.email}</Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{roleLabel[person.role]}</Typography>
              </Box>
              <Divider />
              {canView("access") ? <MenuItem component={NextLink} href="/access" onClick={() => setMenu(null)}>Manage access</MenuItem> : null}
              <MenuItem onClick={() => { setStaffId(null); setNavOpen(false); setMenu(null); }}>
                <LogoutOutlinedIcon sx={{ fontSize: 18, mr: 1 }} /> Sign out
              </MenuItem>
            </Menu>
          </Box>
        </Box>
        <Box sx={{ p: { xs: 2, md: 3 }, flex: 1 }}>
          {person?.status === "suspended" ? <Pill tone="hot">Suspended</Pill> : null}
          <AnimatePresence mode="wait">
            <motion.div key={pathname} initial={entered ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>
    </Box>
  );
}
