"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import PartySocket from "partysocket";
import type {
  ClientMessage,
  ServerMessage,
  RoomState,
} from "../../party/types";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";

export function usePartyRoom(roomId: string | null) {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    // Don't connect until we have a room ID
    if (!roomId) return;

    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomId,
    });

    socket.addEventListener("open", () => {
      setConnected(true);
      setError(null);
    });

    socket.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;

        switch (msg.type) {
          case "room-state":
            setRoomState(msg.state);
            break;
          case "player-joined":
            setRoomState((prev) =>
              prev ? { ...prev, players: [...prev.players, msg.player] } : prev,
            );
            break;
          case "player-left":
            setRoomState((prev) =>
              prev
                ? {
                    ...prev,
                    players: prev.players.filter((p) => p.id !== msg.playerId),
                  }
                : prev,
            );
            break;
          case "error":
            setError(msg.message);
            break;
        }
      } catch {
        // ignore non-JSON messages
      }
    });

    socket.addEventListener("close", () => {
      setConnected(false);
    });

    socketRef.current = socket;

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [roomId]);

  // Send a typed message to the server
  const send = useCallback((msg: ClientMessage) => {
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  return { roomState, connected, error, send };
}
