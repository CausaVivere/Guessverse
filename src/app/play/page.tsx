"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { usePartyRoom } from "~/utils/usePartyRoom";

export default function PlayPage() {
  const [playerName, setPlayerName] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [hasJoined, setHasJoined] = useState(false);

  const { roomState, connected, error, send } = usePartyRoom(roomId);

  // ─── Not in a room yet ──────────────────────────────────────
  if (!roomId) {
    return (
      <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-bold">Guessverse</h1>

        <Input
          placeholder="Your name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="w-64"
        />

        <Button
          className="w-64"
          disabled={!playerName.trim()}
          onClick={() => {
            // "Create room" = generate a random room ID and connect
            const id = Math.random().toString(36).substring(2, 8);
            setRoomId(id);
          }}
        >
          Create Room
        </Button>

        <div className="flex w-64 gap-2">
          <Input
            placeholder="Room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toLowerCase())}
          />
          <Button
            disabled={!playerName.trim() || !joinCode.trim()}
            onClick={() => {
              // "Join room" = connect to the room ID someone gave you
              setRoomId(joinCode.trim());
            }}
          >
            Join
          </Button>
        </div>
      </div>
    );
  }

  // ─── Connecting... ──────────────────────────────────────────
  if (!connected) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <p className="text-lg">Connecting to room {roomId}...</p>
      </div>
    );
  }

  // ─── Connected — send join message once ─────────────────────
  if (!hasJoined) {
    send({ type: "join", playerName: playerName.trim() });
    setHasJoined(true);
  }

  // ─── Lobby ──────────────────────────────────────────────────
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold">Room: {roomId}</h1>
      <p className="text-muted-foreground text-sm">
        Share this code with friends to let them join
      </p>

      {error && <p className="text-red-500">{error}</p>}

      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">
          Players ({roomState?.players.length ?? 0})
        </h2>
        {roomState?.players.map((player) => (
          <div key={player.id} className="flex items-center gap-2">
            <span>{player.name}</span>
            {player.id === roomState.hostId && (
              <span className="text-xs text-yellow-500">★ Host</span>
            )}
          </div>
        ))}
      </div>

      {/* Only the host sees the start button */}
      {roomState?.hostId &&
        roomState.players.find((p) => p.name === playerName.trim())?.id ===
          roomState.hostId && (
          <Button onClick={() => send({ type: "start-game" })}>
            Start Game
          </Button>
        )}

      {roomState?.status === "playing" && (
        <p className="text-2xl font-bold text-green-500">Game started!</p>
      )}
    </div>
  );
}
