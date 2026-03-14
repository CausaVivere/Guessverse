"use client";

import { useParty } from "~/utils/PartyProvider";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import Loading from "~/components/ui/loading";
import { useEffect, useMemo, useState } from "react";
import SetVisualizer from "../_components/setVisualiser";
import { cn } from "~/lib/utils";
import { ChevronLeft } from "lucide-react";
import AnimeCharacterInfo from "../_components/characterInfo";
import type { AnimeCharacter } from "~/server/api/utils/jikan";
import Chat from "../_components/chat";

export default function PlayPage() {
  const {
    roomState,
    roomId,
    connected,
    playerId,
    send,
    leaveRoom,
    endTurn,
    player,
  } = useParty();
  const router = useRouter();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!roomState?.turnEndsAt) return null;
    return Math.max(0, Math.ceil((roomState.turnEndsAt - now) / 1000));
  }, [roomState?.turnEndsAt, now]);

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

  const myTurn = roomState.turn === playerId;
  const currentPlayer = roomState.players.find((p) => p.id === roomState.turn);
  const characterToGuess = set.characters.find(
    (c) => c.id === currentPlayer?.characterToGuess,
  ) as AnimeCharacter;

  const canMakeGuess =
    myTurn &&
    remainingSeconds !== null &&
    player?.turnt.length === set.characters.length - 1;

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

      <div className="flex h-full flex-row items-center justify-center gap-5">
        <div className="flex w-full gap-5">
          {!myTurn && (
            <div className="flex h-full w-100 flex-col items-center justify-center">
              <p className="mb-5 text-xl font-semibold">Character to Guess:</p>
              <AnimeCharacterInfo
                className="h-full"
                character={characterToGuess!}
              />
            </div>
          )}
          <SetVisualizer
            set={set}
            inGame={true}
            className={cn("h-full rounded-3xl p-2", {
              "border-2 border-red-800": myTurn,
            })}
          />
        </div>
        <Chat className="h-192 w-100" />
      </div>

      <div className="flex gap-8">
        <Button
          variant="secondary"
          onClick={() => {
            send({ type: "makeGuess", characterId: characterToGuess.id });
          }}
          className={cn(
            "h-24 w-64 bg-blue-900 text-4xl font-bold text-blue-100",
            {
              hidden: !canMakeGuess,
            },
          )}
        >
          Make Guess
        </Button>
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
      </div>

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
