"use client";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Input } from "~/components/ui/input";
import { ButtonGroup } from "~/components/ui/button-group";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import Image from "next/image";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Loader2,
  User,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useSessionStorage } from "~/utils/hooks";
import type { AnimeCharacter } from "../../../generated/prisma/client";
import type { AnimeObject } from "~/server/api/routers/sets";

export default function AnimePage() {
  const [step, setStep] = useState<"selectAnime" | "selectCharacters">(
    "selectAnime",
  );
  const [animes, setAnimes] = useSessionStorage<AnimeObject[]>(
    "foundAnimes",
    [],
  );
  const [selectedAnime, setSelectedAnime] =
    useSessionStorage<AnimeObject | null>("selectedAnime", null);

  const [set, setSet] = useSessionStorage<AnimeCharacter[]>("set", []);
  // const [layout, setLayout] = useState<"6x4" | "6x6">("6x4");

  const layout = "6x4";

  const [name, setName] = useSessionStorage<string>("name", "");

  const createSet = api.sets.createAnimeSet.useMutation({
    onSuccess: (data) => {
      toast.success("Successfully created anime set: " + name);
      setSelectedAnime(null);
      setSet([]);
      setName("");
      setStep("selectAnime");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to create anime set!", {
        description: "Please try again!",
      });
    },
  });

  useEffect(() => {
    if (selectedAnime) {
      setStep("selectCharacters");
    }
  }, [selectedAnime]);

  const handleCreateSet = () => {
    const ids = new Map<number, number>();
    set.forEach((a) => {
      ids.set(a.animeId, ids.get(a.animeId) ? ids.get(a.animeId)! + 1 : 1);
    });

    createSet.mutate({
      name: name.length > 45 ? name.slice(0, 45) : name,
      mostCommonAnimeId:
        Array.from(ids).sort((a, b) => a[1] - b[1])[0]?.[0] ?? 0,
      animeIds: Array.from(ids.keys()),
      characterIds: set.map((c) => c.id),
    });
  };

  return (
    <div className="bg-background flex min-h-screen w-full items-center justify-center">
      <div className="border-foreground flex h-full w-4/5 items-center justify-center rounded-md p-5">
        <div className="flex h-full min-h-screen w-full gap-3">
          {step === "selectAnime" ? (
            <SelectAnime
              selectedAnime={selectedAnime}
              setSelectedAnime={setSelectedAnime}
              setStep={setStep}
              animes={animes}
              setAnimes={setAnimes}
            />
          ) : (
            <SelectCharacters
              anime={selectedAnime!}
              setStep={setStep}
              set={set}
              setSet={setSet}
            />
          )}
          <div className="flex h-full w-full flex-col items-center justify-center">
            {/* <div className="mb-10 flex w-full items-center justify-center gap-2">
          <p className="text-lg font-semibold">Layout</p>
          <Tabs
            defaultValue={layout}
            onValueChange={(val) => setLayout(val as "6x4" | "6x6")}
          >
            <TabsList>
              <TabsTrigger value="6x4">6x4</TabsTrigger>
              <TabsTrigger value="6x6">6x6</TabsTrigger>
            </TabsList>
          </Tabs>
        </div> */}

            <div
              className={cn(
                "grid gap-4",
                layout === "6x4" ? "grid-cols-6" : "grid-cols-6",
              )}
            >
              {Array.from({ length: layout === "6x4" ? 24 : 36 }, (_, i) => {
                const character = set[i];

                return character ? (
                  <div
                    key={character.id}
                    className="border-secondary group flex w-40 flex-col items-center justify-start gap-3 rounded-xl border bg-linear-to-b from-red-950/70 to-slate-950 p-2 hover:cursor-pointer"
                    onClick={() =>
                      setSet((prev) =>
                        prev.filter((c) => c.id !== character.id),
                      )
                    }
                  >
                    {character.image && (
                      <Image
                        src={character.image}
                        alt={character.name}
                        className="w-28 rounded-xl"
                        width={250}
                        height={250}
                      />
                    )}
                    <h3 className="my-auto hidden text-center text-lg font-semibold group-hover:block">
                      {character.name}
                    </h3>
                  </div>
                ) : (
                  <div
                    key={`placeholder-${i}`}
                    className="border-secondary flex h-52 w-40 flex-col items-center justify-center rounded-xl border bg-linear-to-b from-red-950/70 to-slate-950 p-2"
                  >
                    <User size={64} />
                    <h3 className="text-center text-2xl font-semibold">
                      Guessverse
                    </h3>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex w-full items-center gap-3 px-5">
              <Input
                placeholder="Give a name for this anime set"
                value={name}
                onChange={(event) =>
                  event.target.value.length <= 45
                    ? setName(event.target.value)
                    : null
                }
                className="w-96"
              />
              <Button
                onClick={() => handleCreateSet()}
                disabled={
                  name.length < 1 || set.length < 1 || createSet.isPending
                }
                className="text-base font-semibold"
              >
                {createSet.isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Check />
                    Create
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectCharacters({
  anime,
  setStep,
  set,
  setSet,
}: {
  anime: AnimeObject;
  setStep: (step: "selectAnime" | "selectCharacters") => void;
  set: AnimeCharacter[];
  setSet: Dispatch<SetStateAction<AnimeCharacter[]>>;
}) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 9;
  const [data, setData] = useState<AnimeCharacter[]>([]);
  const [characters, setCharacters] = useState<AnimeCharacter[]>([]);

  const hasFetched = useRef(false);

  const getCharacters = api.sets.getAnimeCharacters.useMutation({
    onSuccess: (data: AnimeCharacter[]) => {
      const sorted = [...data].sort((a, b) => b.favorites - a.favorites);
      setData(sorted);
      setCharacters(
        sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
      );
    },
    onError: (err) => {
      toast.error("Failed to fetch characters from IGDB:", {
        description: err.message,
      });
      console.error(err);
    },
  });

  useEffect(() => {
    if (anime && !hasFetched.current) {
      hasFetched.current = true;
      getCharacters.mutate({ animeId: String(anime.mal_id) });
    }
  }, [anime]);

  useEffect(() => {
    setCharacters(
      data.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
    );
  }, [currentPage]);

  useEffect(() => {
    setCharacters(
      data
        .filter((char) =>
          char.name.toLowerCase().includes(search.toLowerCase()),
        )
        .slice(0, pageSize),
    );
    console.log(data);
  }, [search]);

  return (
    <div className="flex h-full w-1/2 flex-col items-center justify-start">
      <ButtonGroup className="w-full">
        <Input
          placeholder="Search for character..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full"
        />
        <Button className="hover:cursor-pointer" variant="secondary">
          Search
        </Button>
      </ButtonGroup>
      <div className="my-10 grid grid-cols-3 gap-4">
        {characters.map((character) => (
          <div
            key={character.id}
            className="border-secondary flex h-64 w-40 flex-col items-center justify-start gap-3 rounded-xl border bg-linear-to-b from-red-950/70 to-slate-950 p-2 hover:cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              const limit = 24;
              if (set.length < limit && !set.includes(character)) {
                setSet((prev) => [...prev, character]);
              }
            }}
          >
            {character.image && (
              <Image
                src={character.image}
                alt={character.name}
                className="w-28 rounded-xl"
                width={250}
                height={250}
              />
            )}
            <h3 className="my-auto text-center text-lg font-semibold">
              {character.name}
            </h3>
          </div>
        ))}
      </div>
      <div className="flex w-full items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => setStep("selectAnime")}
          className="w-1/5"
        >
          Back
        </Button>
        <Button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 0))}
          className="w-2/5"
          disabled={currentPage === 0}
        >
          <ChevronLeft />
          Previous
        </Button>
        <Button
          onClick={() =>
            setCurrentPage((prev) =>
              Math.min(prev + 1, Math.ceil(data.length / pageSize) - 1),
            )
          }
          className="w-2/5"
          disabled={currentPage === Math.ceil(data.length / pageSize) - 1}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

function SelectAnime({
  selectedAnime,
  setSelectedAnime,
  setStep,
  animes,
  setAnimes,
}: {
  selectedAnime: AnimeObject | null;
  setSelectedAnime: (anime: AnimeObject) => void;
  setStep: (step: "selectAnime" | "selectCharacters") => void;
  animes: AnimeObject[];
  setAnimes: (animes: AnimeObject[]) => void;
}) {
  const [search, setSearch] = useState("");

  const searchAnimes = api.sets.getAnimes.useMutation({
    onSuccess: (data) => {
      console.log(data);
      setAnimes(data.data);
    },
    onError: (err) => {
      toast.error("Failed to fetch animes from IGDB:", {
        description: err.message,
      });
      console.error(err);
    },
  });

  return (
    <div className="flex w-1/2 flex-col rounded-md">
      <ButtonGroup className="w-full">
        <Input
          placeholder="Search for anime..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              searchAnimes.mutate({ search });
            }
          }}
        />
        <Button
          className="hover:cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            searchAnimes.mutate({ search });
          }}
          variant="secondary"
        >
          Search
        </Button>
      </ButtonGroup>
      <div className="mt-5 flex flex-col gap-2">
        {animes && animes.length > 0 ? (
          animes
            ?.sort(
              (a: AnimeObject, b: AnimeObject) =>
                (a.popularity ?? 0) - (b.popularity ?? 0),
            )
            .map((anime: AnimeObject) => (
              <div
                key={anime.mal_id}
                className={cn(
                  "border-secondary flex items-center rounded-lg border px-4 py-2 hover:cursor-pointer hover:bg-zinc-800",
                  selectedAnime?.mal_id === anime.mal_id
                    ? "border border-zinc-300 bg-zinc-900"
                    : "",
                )}
                onClick={() => setSelectedAnime(anime)}
              >
                {anime.images.jpg.image_url ? (
                  <Image
                    src={anime.images.jpg.image_url}
                    alt={anime.title_english ?? anime.title}
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
                  <h3 className="text-lg font-semibold">{anime.title}</h3>
                </div>
              </div>
            ))
        ) : (
          <p>No animes found</p>
        )}
      </div>
      <Button
        className="mt-5"
        disabled={!selectedAnime}
        onClick={() => setStep("selectCharacters")}
      >
        Continue
        <ChevronRight />
      </Button>
    </div>
  );
}
