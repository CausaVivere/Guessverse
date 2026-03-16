import { cn } from "~/lib/utils";
import { useParty } from "~/utils/PartyProvider";
import { Crown, PlugZap, Skull, Swords, WifiOff } from "lucide-react";
import type { CSSProperties } from "react";
import { twColor500ToRgb } from "~/utils/general";

export default function Players({
  className,
  ...props
}: {
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const { roomState, playerId } = useParty();
  const players = roomState?.players ?? [];

  return (
    <div
      className={cn(
        "no-scrollbar flex h-full w-full flex-col overflow-scroll",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-1">
        {players.map((p) => {
          const isMe = p.id === playerId;
          const isTurn = roomState?.turn === p.id;
          const isHost = roomState?.hostId === p.id;
          const rgb = twColor500ToRgb(p.color);

          const status = !p.connected
            ? "disconnected"
            : p.eliminated
              ? "eliminated"
              : "active";

          return (
            <div
              key={p.id}
              className={cn(
                "bg-background relative flex h-8 items-center gap-3 rounded-lg border px-3 py-2 backdrop-blur-2xl",
                {
                  "border-[rgb(var(--player-rgb)/0.35)] bg-[rgb(var(--player-rgb)/0.08)]":
                    isTurn,
                  "opacity-65": status !== "active",
                },
              )}
              style={
                {
                  "--player-rgb": rgb,
                } as CSSProperties
              }
            >
              <div
                className="h-3 w-3 rounded-full border border-white/40"
                style={{
                  backgroundColor: `rgb(${rgb})`,
                  borderColor: isTurn ? `rgb(${rgb})` : undefined,
                }}
              />

              <div className="flex min-w-0 items-center gap-2">
                <div
                  className="truncate text-sm font-semibold"
                  style={{ color: `rgb(${rgb})` }}
                >
                  {p.name}
                  {isMe ? " (you)" : ""}
                </div>
                <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[11px]">
                  {isHost ? (
                    <span className="inline-flex items-center gap-1">Host</span>
                  ) : null}
                </div>
              </div>

              <div>
                {/* {status === "active" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    Active
                  </span>
                ) : null} */}
                {status === "eliminated" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-500/35 bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-300">
                    <Skull className="h-3 w-3" /> Eliminated
                  </span>
                ) : null}
                {status === "disconnected" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/35 bg-slate-500/15 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                    <WifiOff className="h-3 w-3" /> Disconnected
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}

        {players.length === 0 ? (
          <div className="text-muted-foreground col-span-full rounded-lg border border-dashed px-3 py-4 text-center text-sm">
            No players yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
