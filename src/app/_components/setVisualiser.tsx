import { cn } from "~/lib/utils";
import Image from "next/image";
import type { AnimeCharacter, AnimeGameSet } from "~/server/api/utils/jikan";
import { useParty } from "~/utils/PartyProvider";
import { User2 } from "lucide-react";

export default function SetVisualizer({
  set,
  className,
  inGame,
}: {
  set: AnimeGameSet;
  className?: string;
  inGame?: boolean;
}) {
  const { turnCard } = useParty();
  return (
    <div className={cn("grid h-full w-fit grid-cols-6 gap-6", className)}>
      {set.characters.map((char) => (
        <CharacterCard
          key={char.id}
          char={char}
          onClick={() => {
            if (inGame) turnCard(char.id);
          }}
          inGame={inGame}
        />
      ))}
    </div>
  );
}

export function CharacterCard({
  char,
  className,
  inGame,
  ...props
}: {
  char: AnimeCharacter;
  className?: string;
  inGame?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  const { player, roomState } = useParty();
  const nowPlaying = roomState?.players.find((p) => p.id === roomState.turn);
  const isTurnt = !inGame ? false : nowPlaying?.turnt.includes(char.id);
  return (
    <div
      className={cn(
        "group flex h-44 w-30 flex-col items-center justify-center rounded-3xl bg-linear-to-b from-red-950/40 to-zinc-950 p-2 hover:cursor-pointer",
        className,
      )}
      {...props}
    >
      {!isTurnt ? (
        <Image
          alt={char.name + " image"}
          src={char.image!}
          width={500}
          height={800}
          className="h-40 w-28 rounded-2xl"
        />
      ) : (
        <div className="h-40 w-28 rounded-2xl">
          <User2 className="h-full w-full" color="gray" />
        </div>
      )}
    </div>
  );
}
