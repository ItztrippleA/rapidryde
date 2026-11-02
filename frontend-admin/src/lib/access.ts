import type { StaffRole } from "./types";

export type Section =
  | "dashboard"
  | "analytics"
  | "drivers"
  | "customers"
  | "map"
  | "rides"
  | "deliveries"
  | "zones"
  | "pricing"
  | "subscriptions"
  | "promos"
  | "notifications"
  | "support"
  | "config"
  | "access";

export const sections: Section[] = [
  "dashboard",
  "analytics",
  "drivers",
  "customers",
  "map",
  "rides",
  "deliveries",
  "zones",
  "pricing",
  "subscriptions",
  "promos",
  "notifications",
  "support",
  "config",
  "access",
];

export const sectionLabel: Record<Section, string> = {
  dashboard: "Overview",
  analytics: "Analytics",
  drivers: "Drivers",
  customers: "Customers",
  map: "Fleet map",
  rides: "Rides",
  deliveries: "Deliveries",
  zones: "Zones",
  pricing: "Pricing",
  subscriptions: "Subscriptions",
  promos: "Promos",
  notifications: "Notifications",
  support: "Support chat",
  config: "Configuration",
  access: "Access",
};

export const roleLabel: Record<StaffRole, string> = {
  owner: "Owner",
  operations: "Operations",
  support: "Support",
  finance: "Finance",
  viewer: "Viewer",
};

const all = sections;

export const grants: Record<StaffRole, { view: Section[]; edit: Section[] }> = {
  owner: { view: all, edit: all },
  operations: {
    view: ["dashboard", "analytics", "drivers", "customers", "map", "rides", "deliveries", "zones", "support"],
    edit: ["drivers", "customers", "rides", "deliveries", "zones"],
  },
  support: {
    view: ["dashboard", "analytics", "customers", "drivers", "map", "rides", "deliveries", "notifications", "support"],
    edit: ["customers", "rides", "deliveries", "notifications", "support"],
  },
  finance: {
    view: ["dashboard", "analytics", "rides", "pricing", "subscriptions", "promos"],
    edit: ["pricing", "subscriptions", "promos"],
  },
  viewer: {
    view: ["dashboard", "analytics", "drivers", "customers", "map", "rides", "deliveries", "support"],
    edit: [],
  },
};

export function roleSummary(role: StaffRole) {
  const grant = grants[role];
  return `${grant.edit.length} desks can be changed · ${grant.view.length} can be opened`;
}
