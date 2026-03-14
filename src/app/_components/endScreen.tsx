import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useParty } from "~/utils/PartyProvider";

export default function EndScreen({
  className,
  ...props
}: {
  className?: string;
} & React.HTMLProps<HTMLDivElement>) {
  const [timer, setTimer] = useState(10);
  const { roomState, player } = useParty();

  const winner = roomState?.players.find((p) => p.id === roomState.winnerId);
  const guess = roomState?.set?.characters.find(
    (c) => c.id === winner?.characterToGuess,
  );

  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev === 0) {
          //   router.push("/lobby");
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [winner, guess]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-center">
        <Image
          src={guess?.image ?? ""}
          alt={guess?.name ?? "character"}
          width={1920}
          height={1080}
          className="mb-4 h-48 w-48 rounded-lg object-cover"
        />
        <div className="flex flex-col">
          <h2 className="text-4xl font-bold text-white">
            {winner ? `${winner.name} Wins!` : "Game Over"}
          </h2>
          <p className="text-3xl text-white">
            {guess ? guess.name : "No Guess"}
          </p>
        </div>
      </div>
      <div>
        <p className="mt-4 text-center text-sm text-white">
          Returning to lobby in {timer}s...
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            router.push("/lobby");
          }}
        >
          <ChevronLeft />
          Return to lobby
        </Button>
      </div>
    </div>
  );
}
