"use client";

import { useParty } from "~/utils/PartyProvider";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import Loading from "~/components/ui/loading";
import { useEffect } from "react";
import SetVisualizer from "../_components/setVisualiser";
import { cn } from "~/lib/utils";
import { ChevronLeft } from "lucide-react";

export default function PlayPage() {
  const { roomState, roomId, connected, playerId, send, leaveRoom, endTurn } =
    useParty();
  const router = useRouter();

  useEffect(() => {
    if (!roomId) {
      router.push("/");
    }
  }, [roomId, router]);

  // Not in a room — redirect to home
  if (!roomId) {
    return <Loading message="Joining room..." fullScreen />;
  }

  if (!connected || !roomState) {
    return <Loading message="Reconnecting to room..." fullScreen />;
  }

  // Still in lobby — go back
  if (roomState.status === "waiting") {
    return (
      <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-lg">Waiting for the host to start the game...</p>
        <Button variant="secondary" onClick={() => router.push("/")}>
          Back to Lobby
        </Button>
      </div>
    );
  }

  const set = roomState.set!;
  const currentTurnPlayer = roomState.players.find(
    (p) => p.id === roomState.turn,
  );
  const remainingSeconds =
    roomState.timeRemainingMs != null
      ? Math.ceil(roomState.timeRemainingMs / 1000)
      : null;

  // ─── Game is playing ────────────────────────────────────────
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="flex w-full max-w-3xl flex-col items-center justify-center gap-5 px-4">
        <div className="text-3xl">
          <span className="font-medium">Turn:</span>{" "}
          {currentTurnPlayer?.name ?? "—"}
          {roomState.turn === playerId ? " (you)" : ""}
        </div>
        <div className="text-5xl font-bold text-yellow-500">
          {remainingSeconds != null ? `${remainingSeconds}s` : "—"}
        </div>
      </div>

      <div className="flex h-full w-full flex-row items-center justify-center gap-5">
        <SetVisualizer set={set} inGame={true} />
      </div>

      <Button
        variant="secondary"
        onClick={(e) => {
          e.preventDefault();
          endTurn();
        }}
        className={cn(
          "h-24 w-64 bg-yellow-900 text-4xl font-bold text-yellow-100",
          {
            hidden: roomState?.turn !== playerId,
          },
        )}
      >
        END TURN
      </Button>

      <Button
        variant="destructive"
        onClick={() => {
          leaveRoom();
          router.push("/");
        }}
        className="fixed top-5 left-5 h-12 text-lg"
      >
        <ChevronLeft />
        Leave Game
      </Button>
    </div>
  );
}
