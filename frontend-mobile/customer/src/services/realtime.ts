import { io, type Socket } from "socket.io-client";
import { hasRideService, rideBase } from "../lib/api";
import { readToken } from "../lib/session";
import type { DriverCard, TripStage } from "../store/useCustomerStore";

export type TripChatPayload = {
  text: string;
  kind?: "text" | "voice";
  audioUrl?: string;
  durationMs?: number;
};

type Handlers = {
  onStatus: (status: "off" | "live" | "reconnecting") => void;
  onDriver: (driver: DriverCard) => void;
  /** Driver adjusted fare / bid before accept — show on matching board. */
  onBid?: (driver: DriverCard) => void;
  onStage: (stage: TripStage) => void;
  onLocation: (latitude: number, longitude: number) => void;
  onMessage: (payload: TripChatPayload) => void;
  onNone: () => void;
  onFare?: (fare: number, quoted: number) => void;
};

let socket: Socket | null = null;
let joinedRideId = "";

export async function connectRide(handlers: Handlers, rideId?: string): Promise<void> {
  if (!hasRideService()) {
    handlers.onStatus("off");
    return;
  }
  const token = await readToken();
  socket?.close();
  joinedRideId = "";
  socket = io(rideBase, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
  });

  socket.on("ride:driver", (driver: DriverCard) => handlers.onDriver(driver));
  socket.on("ride:bid", (driver: DriverCard) => handlers.onBid?.(driver));
  socket.on("ride:stage", (body: { stage: TripStage }) => handlers.onStage(body.stage));
  socket.on("ride:location", (body: { latitude: number; longitude: number }) =>
    handlers.onLocation(body.latitude, body.longitude),
  );
  socket.on(
    "trip:message",
    (body: {
      from?: string;
      text?: string;
      kind?: "text" | "voice";
      audioUrl?: string;
      durationMs?: number;
    }) => {
      /** Only inbound driver messages — ignore our own room echo. */
      if (body.from && body.from !== "driver") return;
      const audioUrl = body.audioUrl;
      const kind = body.kind || (audioUrl ? "voice" : "text");
      handlers.onMessage({
        text: (body.text || (audioUrl ? "Voice note" : "")).trim(),
        kind,
        audioUrl,
        durationMs: body.durationMs,
      });
    },
  );
  socket.on("ride:none", () => handlers.onNone());
  socket.on("ride:fare", (body: { fare: number; quoted?: number }) =>
    handlers.onFare?.(body.fare, body.quoted ?? body.fare),
  );
  socket.on("disconnect", () => handlers.onStatus("reconnecting"));

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = setTimeout(finish, 8_000);
    socket!.on("connect", () => {
      handlers.onStatus("live");
      if (rideId) joinRide(rideId);
      clearTimeout(timer);
      finish();
    });
    socket!.once("connect_error", () => {
      handlers.onStatus("reconnecting");
      clearTimeout(timer);
      finish();
    });
  });
}

export function joinRide(rideId: string) {
  const id = rideId.trim();
  if (!id || !socket?.connected) return;
  joinedRideId = id;
  socket.emit("ride:join", { id });
}

export function publishRide(event: string, body: unknown) {
  if (!socket?.connected) return;
  socket.emit(event, body);
}

/** Stream passenger GPS into the ride session (admin looking board / disputes). */
export function publishPassengerLocation(
  rideId: string,
  latitude: number,
  longitude: number,
  heading?: number | null,
) {
  if (!socket?.connected || !rideId) return;
  socket.emit("passenger:location", {
    id: rideId,
    latitude,
    longitude,
    heading: heading != null && Number.isFinite(heading) ? heading : undefined,
  });
}

export function stopRide() {
  if (joinedRideId && socket?.connected) {
    socket.emit("ride:leave", { id: joinedRideId });
  }
  joinedRideId = "";
  socket?.close();
  socket = null;
}
