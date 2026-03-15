"use client";
import { useEffect, useState } from "react";
import { Input } from "~/components/ui/input";
import { ButtonGroup } from "~/components/ui/button-group";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import Image from "next/image";
import { ChevronRight, Gamepad2 } from "lucide-react";
import { cn } from "~/lib/utils";

export default function GamesPage() {
  const [step, setStep] = useState<"selectGame" | "selectCharacters">(
    "selectGame",
  );
  const [selectedGame, setSelectedGame] = useState<GameObject | null>(null);

  return (
    <div className="bg-background flex min-h-screen w-full items-center justify-center">
      <div className="border-foreground flex h-full w-3/5 items-center justify-center rounded-md p-5">
        {step === "selectGame" ? (
          <SelectGame
            selectedGame={selectedGame}
            setSelectedGame={setSelectedGame}
            setStep={setStep}
          />
        ) : (
          <SelectCharacters game={selectedGame!} setStep={setStep} />
        )}
      </div>
    </div>
  );
}

function SelectCharacters({
  game,
  setStep,
}: {
  game: GameObject;
  setStep: (step: "selectGame" | "selectCharacters") => void;
}) {
  const [characters, setCharacters] = useState<CharacterObject[]>([]);
  const getCharacters = api.sets.getGameCharacters.useMutation({
    onSuccess: (data) => {
      console.log(data);
      setCharacters(data);
    },
    onError: (err) => {
      toast.error("Failed to fetch characters from IGDB:", {
        description: err.message,
      });
      console.error(err);
    },
  });

  useEffect(() => {
    if (game) {
      getCharacters.mutate({ gameId: String(game.id) });
    }
  }, [game]);

  return (
    <div>
      {characters.map((character) => (
        <div key={character.id}>
          <h3>{character.name}</h3>
          {character.mug_shot && (
            <Image
              src={getIgdbImageUrl(character.mug_shot.url, "logo_med")}
              alt={character.name}
              width={100}
              height={100}
            />
          )}
        </div>
      ))}
      <div>
        <Button variant="secondary" onClick={() => setStep("selectGame")}>
          Back
        </Button>
      </div>
    </div>
  );
}

function SelectGame({
  selectedGame,
  setSelectedGame,
  setStep,
}: {
  selectedGame: GameObject | null;
  setSelectedGame: (game: GameObject) => void;
  setStep: (step: "selectGame" | "selectCharacters") => void;
}) {
  const [search, setSearch] = useState("");

  const searchGames = api.sets.getGames.useMutation({
    onSuccess: (data) => {
      console.log(data);
    },
    onError: (err) => {
      toast.error("Failed to fetch games from IGDB:", {
        description: err.message,
      });
      console.error(err);
    },
  });

  return (
    <div className="flex w-full flex-col rounded-md">
      <ButtonGroup className="w-full">
        <Input
          placeholder="Search for game..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              searchGames.mutate({ search });
            }
          }}
        />
        <Button
          className="hover:cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            searchGames.mutate({ search });
          }}
          variant="secondary"
        >
          Search
        </Button>
      </ButtonGroup>
      <div className="mt-5 flex flex-col gap-2">
        {searchGames.data && searchGames.data.length > 0 ? (
          searchGames.data.map((game: GameObject) => (
            <div
              key={game.id}
              className={cn(
                "border-secondary flex items-center rounded-lg border px-4 py-2 hover:cursor-pointer hover:bg-zinc-800",
                selectedGame?.id === game.id
                  ? "border border-zinc-300 bg-zinc-900"
                  : "",
              )}
              onClick={() => setSelectedGame(game)}
            >
              {game.cover ? (
                <Image
                  src={getIgdbImageUrl(game.cover.url, "logo_med")}
                  alt={game.name}
                  className="mt-2 h-16 w-16 rounded-md"
                  width={500}
                  height={500}
                />
              ) : (
                <div className="border-secondary flex h-16 w-16 items-center justify-center rounded-md border">
                  <Gamepad2 />
                </div>
              )}
              <div className="ml-4">
                <h3 className="text-lg font-semibold">{game.name}</h3>
              </div>
            </div>
          ))
        ) : (
          <p>No games found</p>
        )}
      </div>
      <Button
        className="mt-5"
        disabled={!selectedGame}
        onClick={() => setStep("selectCharacters")}
      >
        Continue
        <ChevronRight />
      </Button>
    </div>
  );
}

export type GameObject = {
  id: string;
  name: string;
  cover: {
    url: string;
  } | null;
  genres: { id: number; name: string }[] | null;
  first_release_date: number | null;
  summary: string | null;
  platforms: { id: number; name: string }[] | null;
  involved_companies:
    | { id: number; company: { id: number; name: string } }[]
    | null;
};

export type IgdbImageSize =
  | "micro" // 35x35
  | "thumb" // 90x90
  | "cover_small" // 90x128
  | "logo_med" // 284x160
  | "cover_big" // 227x320
  | "screenshot_med" // 569x320
  | "screenshot_big" // 889x500
  | "screenshot_huge" // 1280x720
  | "720p" // 1280x720
  | "1080p"; // 1920x1080

function getIgdbImageUrl(
  url: string,
  size: IgdbImageSize = "cover_big",
): string {
  return url.replace("t_thumb", `t_${size}`).replace("//", "https://");
}

export type CharacterObject = {
  id: string;
  name: string;
  mug_shot: {
    url: string;
  } | null;
  description: string | null;
  gender: number | null;
  species: number | null;
};
