"use client";

import { useParty } from "~/utils/PartyProvider";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import Loading from "~/components/ui/loading";
import { useCallback, useEffect, useMemo, useState } from "react";
import SetVisualizer from "../_components/setVisualiser";
import { cn } from "~/lib/utils";
import { ChevronLeft } from "lucide-react";
import AnimeCharacterInfo from "../_components/characterInfo";
import type { AnimeCharacter } from "~/server/api/utils/jikan";
import Chat from "../_components/chat";
import {
  Crown,
  MousePointerClick,
  MessageCircleQuestion,
  Skull,
} from "lucide-react";
import EndScreen from "../_components/endScreen";
import DrawScreen from "../_components/drawScreen";
import EliminationScreen from "../_components/eliminationScreen";
import Players from "./_components/players";

export default function PlayPage() {
  const [gameOver, setGameOver] = useState(false);
  const [showElimination, setShowElimination] = useState(false);

  const {
    roomState,
    roomId,
    connected,
    playerId,
    send,
    leaveRoom,
    endTurn,
    player,
    incorrectGuess,
    clearIncorrectGuess,
  } = useParty();
  const router = useRouter();

  const handleCloseElimination = useCallback(() => {
    setShowElimination(false);
    clearIncorrectGuess();
  }, [clearIncorrectGuess]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!roomState?.turnEndsAt) return null;
    return Math.max(0, Math.ceil((roomState.turnEndsAt - now) / 1000));
  }, [roomState?.turnEndsAt, now]);

  const gameTimeLeftSeconds = useMemo(() => {
    if (!roomState?.gameStartedAt) return null;
    const elapsed = now - roomState.gameStartedAt;
    return Math.max(
      0,
      Math.ceil((roomState.maxGameDurationMs - elapsed) / 1000),
    );
  }, [roomState?.gameStartedAt, roomState?.maxGameDurationMs, now]);

  const turnsLeft = useMemo(() => {
    if (!roomState) return null;
    return Math.max(0, roomState.maxTurns - roomState.turnCount);
  }, [roomState]);

  useEffect(() => {
    if (!roomId) {
      router.push("/");
    }
  }, [roomId, router]);

  useEffect(() => {
    if (roomState?.status === "finished" || roomState?.winnerId) {
      setGameOver(true);
    }
  }, [roomState]);

  useEffect(() => {
    if (!incorrectGuess) return;
    if (roomState?.status === "finished") return;
    setShowElimination(true);
  }, [incorrectGuess, roomState?.status]);

  useEffect(() => {
    if (!gameOver) return;
    setShowElimination(false);
    clearIncorrectGuess();
  }, [gameOver, clearIncorrectGuess]);

  // Not in a room — redirect to home
  if (!roomId) {
    return <Loading message="Joining room..." fullScreen />;
  }

  if (!connected || !roomState) {
    return <Loading message="Reconnecting to room..." fullScreen />;
  }

  // Still in lobby — go back
  if (roomState.status === "waiting" && !gameOver) {
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

  const guessedCharacterId =
    set.characters.find((c) => !player?.turnt.includes(c.id))?.id ?? null;

  const isDraw = roomState.status === "finished" && roomState.winnerId === null;

  // ─── Game is playing ────────────────────────────────────────
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="mt-10 flex w-full max-w-3xl items-center justify-center gap-5 px-4">
        <div className="text-3xl">
          <span className="font-medium">Turn:</span>{" "}
          {currentTurnPlayer?.name ?? "—"}
          {roomState.turn === playerId ? " (you)" : ""}
        </div>
        <div className="text-3xl font-bold text-yellow-500">
          {remainingSeconds != null ? `${remainingSeconds}s` : "—"}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/85 uppercase">
          <span className="rounded-full border border-white/20 bg-white/5 px-2 py-1 tracking-wide">
            Game left:{" "}
            {gameTimeLeftSeconds != null
              ? `${Math.floor(gameTimeLeftSeconds / 60)}m ${gameTimeLeftSeconds % 60}s`
              : "—"}
          </span>
          <span className="rounded-full border border-white/20 bg-white/5 px-2 py-1 tracking-wide">
            Turns left: {turnsLeft ?? "—"}
          </span>
        </div>
      </div>

      <div className="flex h-full flex-row items-center justify-center">
        <div className="flex w-full gap-5">
          {!myTurn ? (
            <div className="flex h-full w-100 flex-col items-center justify-center">
              <p className="mb-5 text-xl font-semibold">Character to Guess:</p>
              <AnimeCharacterInfo
                className="h-full"
                character={characterToGuess!}
              />
            </div>
          ) : (
            <Instructions className="h-full w-100" />
          )}
          <SetVisualizer
            set={set}
            inGame={true}
            turnChangeToken={roomState.turn ?? undefined}
            turnLabel={currentTurnPlayer?.name ?? "Unknown"}
            className={cn("h-full rounded-3xl p-2")}
            myTurn={myTurn}
          />
        </div>
        <div className="-ml-18 flex h-192 max-h-192 min-h-0 w-120 flex-col items-stretch gap-2">
          <Players className="h-auto max-h-64 w-full shrink-0 overflow-y-auto" />
          <Chat className="min-h-0 w-full flex-1" />
        </div>
      </div>

      <div className="flex h-60 gap-8">
        <Button
          variant="secondary"
          onClick={() => {
            if (!guessedCharacterId) return;
            send({ type: "makeGuess", characterId: guessedCharacterId });
          }}
          className={cn(
            "h-24 w-64 bg-blue-900 text-4xl font-bold text-blue-100",
            {
              hidden: !canMakeGuess || !guessedCharacterId,
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

      <div
        className={
          gameOver || (showElimination && !!incorrectGuess)
            ? "absolute inset-0 z-50 flex items-center justify-center"
            : "hidden"
        }
      >
        {gameOver && isDraw ? <DrawScreen /> : null}
        {gameOver && !isDraw ? <EndScreen /> : null}
        {!gameOver && showElimination && incorrectGuess ? (
          <EliminationScreen
            message={incorrectGuess.message}
            guessedChar={incorrectGuess.characterId}
            eliminatedPlayerId={incorrectGuess.playerId}
            eliminatedName={incorrectGuess.playerName}
            onClose={handleCloseElimination}
          />
        ) : null}
      </div>
    </div>
  );
}

function Instructions({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border-accent/60 from-background via-background to-muted/40 relative overflow-hidden rounded-2xl border bg-linear-to-br p-5 shadow-lg",
        className,
      )}
    >
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-yellow-500/10 blur-3xl" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="border-accent/60 flex h-11 w-11 items-center justify-center rounded-xl border bg-yellow-500/10">
            <Crown className="h-5 w-5 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-widest text-yellow-500">
              YOUR TURN
            </h2>
            <p className="text-muted-foreground text-xs">
              Ask smart questions, flip cards fast.
            </p>
          </div>
        </div>
        <div className="text-muted-foreground border-border/60 bg-background/60 rounded-md border px-2 py-1 text-[11px] backdrop-blur">
          Round: live
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="border-border/60 bg-background/60 rounded-xl border p-3 backdrop-blur">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium">
            <MessageCircleQuestion className="h-4 w-4 text-blue-400" />
            Use chat to narrow it down
          </div>
          <p className="text-muted-foreground text-sm">
            It's your turn to guess the character! Use the chat to ask questions
            and narrow down the possibilities.
          </p>
          <p className="text-muted-foreground mt-2 text-sm font-bold">
            YES or NO questions ONLY!
          </p>
          <p className="mt-2 text-sm text-blue-400/80">
            Pro tip: ask about the character's anime, role, or traits to get
            useful hints from other players.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div className="border-border/60 bg-background/60 rounded-xl border p-3 backdrop-blur">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium">
              <MousePointerClick className="h-4 w-4 text-emerald-400" />
              Controls
            </div>
            <ul className="text-muted-foreground space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-foreground border-border/70 bg-muted/40 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium">
                  Click
                </span>
                <span>turn a character card</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-foreground border-border/70 bg-muted/40 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium">
                  Hold click
                </span>
                <span>make a guess</span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-red-300">
              <Skull className="h-4 w-4" />
              Sudden death
            </div>
            <p className="text-sm text-red-200/80">
              If you guess wrong, you get eliminated.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
