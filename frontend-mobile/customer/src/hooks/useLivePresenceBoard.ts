import { useEffect, useState } from "react";
import { api, hasApi } from "../lib/api";

export type PresencePeer = {
  id: string;
  role: "customer" | "driver";
  name: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  km?: number;
};

export type PresenceBoard = {
  peers: PresencePeer[];
  selfRole: "customer" | "driver" | null;
  selfId: string | null;
  boardSize: number;
};

/** Temporary: publish self + pull nearby peers so both apps can verify GPS. */
export function useLivePresenceBoard(
  coords: { latitude: number; longitude: number; heading?: number | null } | null,
  name?: string,
): PresenceBoard {
  const [board, setBoard] = useState<PresenceBoard>({
    peers: [],
    selfRole: null,
    selfId: null,
    boardSize: 0,
  });

  useEffect(() => {
    if (!hasApi() || !coords) {
      setBoard({ peers: [], selfRole: null, selfId: null, boardSize: 0 });
      return;
    }
    let alive = true;
    const sync = () => {
      void api("/debug/presence", {
        method: "POST",
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
          heading: coords.heading ?? undefined,
          name: name || undefined,
        }),
      }).catch(() => undefined);
      void api<{
        peers?: PresencePeer[];
        selfRole?: "customer" | "driver";
        selfId?: string;
        boardSize?: number;
      }>(
        `/debug/presence/nearby?lat=${encodeURIComponent(String(coords.latitude))}&lng=${encodeURIComponent(String(coords.longitude))}&radiusKm=40`,
      )
        .then((body) => {
          if (!alive) return;
          setBoard({
            peers: Array.isArray(body?.peers) ? body.peers : [],
            selfRole: body?.selfRole === "driver" || body?.selfRole === "customer" ? body.selfRole : null,
            selfId: typeof body?.selfId === "string" ? body.selfId : null,
            boardSize: typeof body?.boardSize === "number" ? body.boardSize : 0,
          });
        })
        .catch(() => {
          if (alive) setBoard({ peers: [], selfRole: null, selfId: null, boardSize: 0 });
        });
    };
    sync();
    const timer = setInterval(sync, 4_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [coords?.latitude, coords?.longitude, coords?.heading, name]);

  return board;
}
