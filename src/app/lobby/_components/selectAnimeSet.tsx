"use client";

import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import Loading from "~/components/ui/loading";
import { api } from "~/trpc/react";
import { useParty } from "~/utils/PartyProvider";
import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { ButtonGroup } from "~/components/ui/button-group";
import { cn } from "~/lib/utils";

export default function SelectAnimeSet({
  changingSet,
  setIsChangingSet,
}: {
  changingSet: boolean;
  setIsChangingSet: (changing: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const { roomState, selectSet, isFetchingSet } = useParty();

  const { data: sets, isLoading } = api.sets.getAnimeSets.useQuery({
    search: query,
    limit: 20,
  });

  useEffect(() => {
    setTimeout(() => {
      setQuery(search);
    }, 500);
  }, [search]);

  const set = roomState!.set;

  return (
    <div className="relative flex h-full w-full flex-col gap-3 overflow-hidden rounded-[2rem] border border-red-300/35 bg-zinc-950/85 p-5 shadow-[0_20px_50px_rgba(2,6,23,0.5)]">
      <div className="pointer-events-none absolute inset-1 rounded-[1.75rem] border border-white/8" />

      <div className="relative text-xl font-semibold tracking-[0.22em] text-red-100/75 uppercase">
        Select Character Set
      </div>

      <ButtonGroup className="mb-2 w-full">
        <Input
          placeholder="Search for character set by anime name or character name..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full"
          maxLength={45}
        />
        <Button className="hover:cursor-pointer" variant="secondary">
          Search
        </Button>
      </ButtonGroup>
      <div className="no-scrollbar flex h-195 flex-col gap-3 overflow-y-scroll">
        {isLoading ? (
          <Loading
            message="Loading character sets..."
            className="h-full w-full"
          />
        ) : sets && sets.length > 0 ? (
          sets.map((s) => (
            <div
              key={s.id}
              className={cn(
                "group relative flex h-24 shrink-0 flex-row gap-3 overflow-hidden rounded-xl border border-red-200/25 bg-zinc-900/60 px-5 py-2 transition-all duration-300 hover:cursor-pointer hover:border-red-200/55 hover:bg-zinc-800/80",
                roomState?.set?.id === s.id
                  ? "border-red-400/80 bg-red-500/15"
                  : "",
              )}
              onClick={(e) => {
                e.preventDefault();
                if (roomState?.set?.id === s.id) {
                  toast.error("This set is already selected!");
                  return;
                }
                selectSet(s.id);
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-white/4 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              {s.img ? (
                <Image
                  alt={s.name + "photo"}
                  src={s.img}
                  width={500}
                  height={500}
                  className="h-20 w-20 rounded-lg border border-white/20 object-cover"
                />
              ) : (
                <div> </div>
              )}
              <div className="h-full w-full">
                <h3 className="text-xl font-semibold">{s.name}</h3>
                <p className="text-lg">By user: {s.creatorName}</p>
                <p className="text-lg">{s.plays} plays</p>
              </div>
            </div>
          ))
        ) : (
          <div className="h-full w-full text-lg font-semibold">
            No character sets found for: {query}
          </div>
        )}
        {isFetchingSet && (
          <Loading
            message="Getting new character set..."
            className="absolute inset-0 z-10 h-full w-full rounded-[2rem] bg-zinc-950/90 backdrop-blur-sm"
          />
        )}
      </div>
      <Button
        onClick={() => setIsChangingSet(false)}
        className="w-full text-lg font-semibold"
        variant="secondary"
      >
        <ChevronLeft className="mr-2" />
        Go Back
      </Button>
    </div>
  );
}
