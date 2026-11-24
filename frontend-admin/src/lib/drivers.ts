import type { BanKind, ComplaintMeterLevel, Driver, DriverProfile } from "./types";

export function emptyDriverProfile(): DriverProfile {
  return {
    middleName: "",
    dob: "",
    gender: "",
    address: "",
    state: "",
    lga: "",
    licenceNumber: "",
    licenceExpiry: "",
    colour: "",
    year: "",
    category: "Sedan",
    fuelType: "",
    inspection: "not_scheduled",
    bankName: "",
    maskedAccount: "",
    bankStatus: "missing",
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
  };
}

export function withProfile(driver: Driver): Driver & { profile: DriverProfile } {
  return { ...driver, profile: { ...emptyDriverProfile(), ...driver.profile } };
}

export function maskAccount(value: string) {
  return value.replace(/\D/g, "").slice(-4);
}

/** Soft/hard bans and non-active accounts stay off the map. */
export function readyToGoLive(driver: Pick<Driver, "status" | "ninStatus" | "papers" | "banKind">) {
  if (driver.banKind === "soft" || driver.banKind === "hard") return false;
  return driver.status === "active" && driver.ninStatus === "verified" && driver.papers === "valid";
}

export function effectiveBanKind(driver: Pick<Driver, "status" | "banKind">): BanKind {
  if (driver.banKind === "soft" || driver.banKind === "hard") return driver.banKind;
  if (driver.status === "closed") return "hard";
  if (driver.status === "suspended") return "soft";
  return null;
}

export function applyBan(driver: Driver, kind: "soft" | "hard", reason: string): Driver {
  const trimmed = reason.trim();
  return {
    ...driver,
    banKind: kind,
    banReason: trimmed || (kind === "hard" ? "Hard ban" : "Soft ban"),
    bannedAt: new Date().toISOString(),
    status: kind === "hard" ? "closed" : "suspended",
    online: false,
  };
}

export function clearBan(driver: Driver): Driver {
  return {
    ...driver,
    banKind: null,
    banReason: "",
    bannedAt: undefined,
    status: "active",
  };
}

/** Score blends open complaints with low star ratings for the desk meter. */
export function complaintMeterScore(driver: Pick<Driver, "rating" | "complaintCount">) {
  const complaints = Math.max(0, driver.complaintCount ?? 0);
  const ratingGap = Math.max(0, 4.2 - (driver.rating ?? 5));
  return Math.round(complaints * 12 + ratingGap * 40);
}

export function complaintMeterLevel(score: number): ComplaintMeterLevel {
  if (score >= 70) return "critical";
  if (score >= 40) return "alert";
  if (score >= 20) return "watch";
  return "clear";
}

export function complaintMeterTone(level: ComplaintMeterLevel): "ok" | "warn" | "hot" | "off" {
  if (level === "clear") return "ok";
  if (level === "watch") return "warn";
  if (level === "alert" || level === "critical") return "hot";
  return "off";
}

export function isLowStarDriver(driver: Pick<Driver, "rating">) {
  return (driver.rating ?? 5) < 4.2;
}
