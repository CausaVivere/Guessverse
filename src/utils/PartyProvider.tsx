"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import PartySocket from "partysocket";
import type {
  ClientMessage,
  ServerMessage,
  RoomState,
  Player,
} from "../../party/types";
import { useLocalStorage } from "./hooks";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { set } from "zod";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";

// ─── Session persistence helpers ─────────────────────────────────
// These use sessionStorage so refreshing the tab reconnects,
// but opening a new tab starts fresh.

function getSession() {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("party-session");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      roomId: string;
      playerId: string;
      playerName: string;
    };
  } catch {
    return null;
  }
}

function setSession(roomId: string, playerId: string, playerName: string) {
  sessionStorage.setItem(
    "party-session",
    JSON.stringify({ roomId, playerId, playerName }),
  );
}

function clearSession() {
  sessionStorage.removeItem("party-session");
}

// Generate a stable player ID (persists across reconnects within a tab)
function getOrCreatePlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem("party-player-id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("party-player-id", id);
  }
  return id;
}

// ─── Context types ───────────────────────────────────────────────
type PartyContextValue = {
  // State
  roomState: RoomState | null;
  roomId: string | null;
  playerId: string;
  playerName: string;
  isHost: boolean;
  connected: boolean;
  error: string | null;
  player: Player | null;

  // Actions
  setPlayerName: (name: string) => void;
  createRoom: () => void;
  joinRoom: (code: string) => void;
  leaveRoom: () => void;
  send: (msg: ClientMessage) => void;
  startGame: () => void;
  selectSet: (setId: string) => void;
  turnCard: (characterId: number) => void;
  endTurn: () => void;
};

const PartyContext = createContext<PartyContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────
export function PartyProvider({ children }: { children: ReactNode }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useLocalStorage("playerName", "");
  const [playerId] = useState(() => getOrCreatePlayerId());
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const socketRef = useRef<PartySocket | null>(null);
  const playerNameRef = useRef(playerName);
  const hasRestoredRef = useRef(false);

  const router = useRouter();
  const pathname = usePathname();

  // Keep the ref in sync so the socket "open" handler always has the latest name
  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  // Restore session on mount (handles page refresh)
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const session = getSession();
    if (session) {
      setPlayerName(session.playerName);
      setRoomId(session.roomId);
    }
  }, []);

  // ─── WebSocket connection lifecycle ──────────────────────────
  useEffect(() => {
    if (!roomId) return;

    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomId,
    });

    socket.addEventListener("open", () => {
      setConnected(true);
      setError(null);

      // Auto-send join on every (re)connect — server handles dedup
      const name = playerNameRef.current.trim();
      if (name) {
        socket.send(
          JSON.stringify({
            type: "join",
            playerId,
            playerName: name,
          } satisfies ClientMessage),
        );
      }
    });

    socket.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;

        switch (msg.type) {
          case "room-state":
            setError(null);
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
            toast.error(msg.message);
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
  }, [roomId, playerId]);

  useEffect(() => {
    if (roomState?.status === "playing" && pathname !== "/play") {
      router.push("/play");
    }
    setIsHost(roomState?.hostId === playerId);
    console.log("Room state changed:", roomState, pathname);
  }, [roomState]);

  // ─── Actions ─────────────────────────────────────────────────
  const createRoom = useCallback(() => {
    const id = Math.random().toString(36).substring(2, 8);
    setSession(id, playerId, playerName.trim());
    setRoomId(id);
  }, [playerId, playerName]);

  const joinRoom = useCallback(
    (code: string) => {
      const id = code.trim().toLowerCase();
      setSession(id, playerId, playerName.trim());
      setRoomId(id);
    },
    [playerId, playerName],
  );

  const leaveRoom = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    clearSession();
    setRoomId(null);
    setRoomState(null);
    setConnected(false);
    setError(null);
  }, []);

  const startGame = useCallback(() => {
    socketRef.current?.send(
      JSON.stringify({
        type: "start-game",
      } satisfies ClientMessage),
    );
  }, []);

  const selectSet = useCallback((setId: string) => {
    socketRef.current?.send(
      JSON.stringify({
        type: "selected-set",
        setId,
      } satisfies ClientMessage),
    );
  }, []);

  const turnCard = useCallback((characterId: number) => {
    socketRef.current?.send(
      JSON.stringify({
        playerId,
        type: "turnCard",
        characterId,
      } satisfies ClientMessage),
    );
  }, []);

  const endTurn = useCallback(() => {
    socketRef.current?.send(
      JSON.stringify({
        type: "endTurn",
      } satisfies ClientMessage),
    );
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  const player = roomState?.players.find((p) => p.id === playerId) ?? null;

  return (
    <PartyContext.Provider
      value={{
        roomState,
        roomId,
        playerId,
        playerName,
        connected,
        error,
        isHost,
        player,
        setPlayerName,
        createRoom,
        joinRoom,
        leaveRoom,
        send,
        startGame,
        selectSet,
        turnCard,
        endTurn,
      }}
    >
      {children}
    </PartyContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────
export function useParty() {
  const ctx = useContext(PartyContext);
  if (!ctx) {
    throw new Error("useParty must be used within a <PartyProvider>");
  }
  return ctx;
}
