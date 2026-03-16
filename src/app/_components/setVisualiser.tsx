import { cn } from "~/lib/utils";
import type { AnimeGameSet } from "~/server/api/utils/jikan";
import { useParty } from "~/utils/PartyProvider";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { useEffect, useRef, type CSSProperties } from "react";
import { Crown } from "lucide-react";

import { CharacterCard } from "./characterCard";
import { twColor500ToRgb } from "~/utils/general";

const BOARD_FLIP_TO_BACK_SECONDS = 0.6;
const BOARD_BACK_HOLD_SECONDS = 1.0;
const BOARD_FLIP_TO_FRONT_SECONDS = 0.6;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function SetVisualizer({
  set,
  className,
  inGame,
  turnChangeToken,
  turnLabel,
  myTurn,
}: {
  set: AnimeGameSet;
  className?: string;
  inGame?: boolean;
  turnChangeToken?: string;
  turnLabel?: string;
  myTurn?: boolean;
}) {
  const { turnCard, send, roomState, player } = useParty();
  const prefersReducedMotion = useReducedMotion();
  const boardControls = useAnimationControls();
  const previousTurnRef = useRef<string | undefined>(turnChangeToken);
  const boardRotationRef = useRef(0);
  const animationRunIdRef = useRef(0);

  const currentPlayer = roomState?.players.find(
    (p) => p.id === roomState?.turn,
  );

  const accent = twColor500ToRgb(
    currentPlayer?.color ?? player?.color ?? "gray-500",
  );

  useEffect(() => {
    if (!turnChangeToken) return;

    const hasChanged =
      previousTurnRef.current && previousTurnRef.current !== turnChangeToken;

    if (prefersReducedMotion) {
      previousTurnRef.current = turnChangeToken;
      return;
    }

    if (hasChanged) {
      const nextFrontRotation = boardRotationRef.current + 360;
      const backRotation = boardRotationRef.current + 180;
      boardRotationRef.current = nextFrontRotation;

      const runId = animationRunIdRef.current + 1;
      animationRunIdRef.current = runId;

      void (async () => {
        await boardControls.start({
          rotateY: backRotation,
          transition: {
            duration: BOARD_FLIP_TO_BACK_SECONDS,
            ease: "easeInOut",
          },
        });
        if (runId !== animationRunIdRef.current) return;

        await wait(BOARD_BACK_HOLD_SECONDS * 1000);
        if (runId !== animationRunIdRef.current) return;

        await boardControls.start({
          rotateY: nextFrontRotation,
          transition: {
            duration: BOARD_FLIP_TO_FRONT_SECONDS,
            ease: "easeInOut",
          },
        });
      })();
    }

    previousTurnRef.current = turnChangeToken;
  }, [boardControls, prefersReducedMotion, turnChangeToken]);

  return (
    <div
      className={cn(
        "relative rounded-[2.2rem] p-0.5 perspective-distant",
        className,
      )}
      style={
        {
          "--accent": accent,
        } as CSSProperties
      }
    >
      <div
        className={cn(
          "absolute -inset-3 rounded-[2.6rem] blur-xl",
          myTurn === true ? "animate-[pulse_3.5s_ease-in-out_infinite]" : "",
          myTurn === true
            ? "border bg-[rgb(var(--accent)/0.6)]"
            : "bg-[rgb(var(--accent)/0.2)]",
        )}
      />

      <motion.div
        className="relative rounded-[2.1rem] border border-red-300/45 bg-zinc-950/95 shadow-[0_20px_60px_rgba(2,6,23,0.65)]"
        style={{
          transformStyle: "preserve-3d",
        }}
        animate={boardControls}
        initial={{ rotateY: 0 }}
      >
        <div className="relative p-4" style={{ backfaceVisibility: "hidden" }}>
          <div className="pointer-events-none absolute inset-1 rounded-[1.95rem] border border-red-200/20" />
          <div className="pointer-events-none absolute inset-0 rounded-[2.05rem] bg-linear-to-b from-white/7 via-transparent to-black/25" />
          <div className="pointer-events-none absolute top-2 right-5 text-[9px] font-semibold tracking-[0.26em] text-red-100/80 uppercase">
            Guessverse - {set.name}
          </div>

          <div className="relative grid h-full w-fit grid-cols-6 gap-6">
            {set.characters.map((char, i) => (
              <CharacterCard
                key={char.id}
                char={char}
                index={i}
                onTurn={() => {
                  if (inGame) {
                    turnCard(char.id);
                  }
                }}
                onGuess={() =>
                  send({ type: "makeGuess", characterId: char.id })
                }
                inGame={inGame}
              />
            ))}
          </div>
        </div>

        <div
          className="absolute inset-0 overflow-hidden rounded-[2.1rem] border border-red-200/50 bg-zinc-950"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="absolute inset-1 rounded-[1.95rem] bg-linear-to-b from-zinc-800 via-zinc-900 to-black" />
          <div className="absolute inset-2 rounded-[1.7rem] border border-red-200/35" />
          <div className="absolute inset-4 rounded-[1.45rem] border border-white/12" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.28)_1px,transparent_0)] bg-size-[10px_10px] opacity-30" />

          <div className="relative flex h-full w-full flex-col items-center justify-center gap-5">
            <div className="text-2xl font-semibold tracking-[0.28em] text-red-100/80 uppercase">
              Guessverse
            </div>

            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-red-200/45 bg-zinc-900/70">
              <div className="absolute inset-1 rounded-full border border-white/25" />
              <Crown className="relative h-10 w-10 text-red-100/90" />
            </div>

            <div className="rounded-xl border border-white/20 bg-black/25 px-6 py-3 text-center">
              <p className="text-lg tracking-[0.2em] text-cyan-100/80 uppercase">
                Next Turn
              </p>
              <p className="mt-1 text-3xl font-semibold text-red-50">
                {turnLabel ?? "Get Ready"}
              </p>
            </div>

            <div className="text-xl tracking-[0.26em] text-red-100/70 uppercase">
              {set.name}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
