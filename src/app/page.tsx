"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useParty } from "~/utils/PartyProvider";
import { useRouter } from "next/navigation";
import Loading from "~/components/ui/loading";

export default function HomePage() {
  const {
    roomId,
    playerName,
    setPlayerName,
    roomState,
    connected,
    error,
    playerId,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
  } = useParty();
  const [joinCode, setJoinCode] = useState("");
  const router = useRouter();

  // ─── Already in a room — redirect to lobby ──────────────────
  useEffect(() => {
    if (roomId && connected && roomState) {
      void router.push("/lobby");
    }
    console.log("HomePage useEffect", {
      roomId,
      connected,
      roomState,
    });
  }, [roomId, connected, roomState, router]);

  if (roomId && connected && roomState) {
    return <Loading message="Joining room..." fullScreen />;
  }

  // ─── Connecting... ──────────────────────────────────────────
  if (roomId && !connected) {
    return (
      <div className="h-full w-full flex-col">
        <Loading message={`Connecting to room ${roomId}...`} fullScreen />;
        <Button
          variant="outline"
          className="absolute bottom-4 left-1/2 -translate-x-1/2"
          onClick={leaveRoom}
        >
          Leave Room
        </Button>
      </div>
    );
  }

  // ─── Not in a room — show create/join ────────────────────────
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">Guessverse</h1>

      <Input
        placeholder="Your name"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        className="w-64"
        maxLength={20}
      />

      <Button
        className="w-64"
        disabled={!playerName.trim()}
        onClick={createRoom}
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
          onClick={() => joinRoom(joinCode)}
        >
          Join
        </Button>
      </div>
    </div>
  );
}
