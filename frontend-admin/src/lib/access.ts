import type { StaffRole } from "./types";

export type Section =
  | "dashboard"
  | "analytics"
  | "drivers"
  | "customers"
  | "survey"
  | "map"
  | "rides"
  | "deliveries"
  | "zones"
  | "pricing"
  | "subscriptions"
  | "promos"
  | "notifications"
  | "email"
  | "support"
  | "config"
  | "doc"
  | "access";

export const sections: Section[] = [
  "dashboard",
  "analytics",
  "drivers",
  "customers",
  "survey",
  "map",
  "rides",
  "deliveries",
  "zones",
  "pricing",
  "subscriptions",
  "promos",
  "notifications",
  "email",
  "support",
  "config",
  "doc",
  "access",
];

export const sectionLabel: Record<Section, string> = {
  dashboard: "Overview",
  analytics: "Analytics",
  drivers: "Drivers",
  customers: "Customers",
  survey: "Survey",
  map: "Fleet map",
  rides: "Rides",
  deliveries: "Deliveries",
  zones: "Zones",
  pricing: "Pricing",
  subscriptions: "Subscriptions",
  promos: "Promos",
  notifications: "Notifications",
  email: "Email",
  support: "Support chat",
  config: "Configuration",
  doc: "Doc",
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
    view: ["dashboard", "analytics", "drivers", "customers", "survey", "map", "rides", "deliveries", "zones", "support", "doc"],
    edit: ["drivers", "customers", "survey", "rides", "deliveries", "zones"],
  },
  support: {
    view: ["dashboard", "analytics", "customers", "drivers", "survey", "map", "rides", "deliveries", "notifications", "email", "support", "doc"],
    edit: ["customers", "survey", "rides", "deliveries", "notifications", "email", "support"],
  },
  finance: {
    view: ["dashboard", "analytics", "rides", "pricing", "subscriptions", "promos", "doc"],
    edit: ["pricing", "subscriptions", "promos"],
  },
  viewer: {
    view: ["dashboard", "analytics", "drivers", "customers", "survey", "map", "rides", "deliveries", "support", "doc"],
    edit: [],
  },
};

export function roleSummary(role: StaffRole) {
  const grant = grants[role];
  return `${grant.edit.length} desks can be changed · ${grant.view.length} can be opened`;
}
