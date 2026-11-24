import { ALONG_SEATS } from "./fare";

export type CabinSeatId = "front" | "rear_left" | "rear_right";

export type CabinSeat = {
  id: CabinSeatId;
  index: number;
  label: string;
  short: string;
};

/** Passenger seats only. Driver stays locked on the cabin drawing. */
const ALL_CABIN_SEATS: CabinSeat[] = [
  { id: "front", index: 0, label: "Front seat", short: "Front" },
  { id: "rear_left", index: 1, label: "Rear left seat", short: "Rear L" },
  { id: "rear_right", index: 2, label: "Rear right seat", short: "Rear R" },
];

export const CABIN_SEATS = ALL_CABIN_SEATS.slice(0, ALONG_SEATS);

export function seatByIndex(index: number) {
  return CABIN_SEATS.find((seat) => seat.index === index) ?? CABIN_SEATS[0];
}

export function firstOpenSeat(taken: number) {
  const open = CABIN_SEATS.find((seat) => seat.index >= taken);
  return open?.index ?? -1;
}

export function seatTaken(index: number, taken: number) {
  return index >= 0 && index < taken;
}

export function seatLabel(index: number) {
  return seatByIndex(index)?.label || "Seat";
}
