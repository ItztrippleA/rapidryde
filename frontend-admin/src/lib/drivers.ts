import type { Driver, DriverProfile } from "./types";

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

/** Pending, suspended, and closed drivers stay off the map. Approval is status "active". */
export function readyToGoLive(driver: Pick<Driver, "status" | "ninStatus" | "papers">) {
  return driver.status === "active" && driver.ninStatus === "verified" && driver.papers === "valid";
}
