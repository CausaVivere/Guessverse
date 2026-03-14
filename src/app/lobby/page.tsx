"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { Input } from "~/components/ui/input";
import Loading from "~/components/ui/loading";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useParty } from "~/utils/PartyProvider";
import SetVisualizer from "../_components/setVisualiser";
import type { AnimeGameSet } from "~/server/api/utils/jikan";
import { Video } from "lucide-react";
import Chat from "../_components/chat";

export default function Lobby() {
  const [changingSet, setIsChangingSet] = useState(false);
  const {
    roomId,
    playerName,
    roomState,
    connected,
    error,
    playerId,
    isHost,
    leaveRoom,
    startGame,
  } = useParty();

  const router = useRouter();

  useEffect(() => {
    if (!connected) {
      router.push("/");
    }
  }, [connected, router]);

  useEffect(() => {
    setIsChangingSet(false);
  }, [roomState?.set]);

  if (!connected) {
    return <Loading message="Connecting to room..." fullScreen />;
  }

  if (!roomState) {
    return <Loading message="Loading room..." fullScreen />;
  }

  return (
    <div className="bg-background flex min-h-screen w-full flex-col items-center justify-center">
      <div className="border-accent w-4/5 flex-col items-center justify-center gap-6 rounded-4xl border px-12 pt-5 pb-24">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Room: {roomId}</h1>
          <p className="text-muted-foreground text-sm">
            Share this code with friends to let them join
          </p>
          {error && <p className="text-red-500">{error}</p>}

          <Separator className="mb-5 w-full" />
        </div>
        <div className="min flex w-full items-start justify-between gap-4">
          <div className="border-accent flex h-[60vh] w-2/5 flex-col gap-2 border-r p-2">
            <p className="text-foreground text-center text-sm font-semibold">
              Click to change set
            </p>
            {roomState?.set ? (
              <div
                className="border-muted mb-5 flex h-24 w-full flex-row gap-3 rounded-xl border px-5 py-2 hover:cursor-pointer hover:bg-zinc-700"
                onClick={(e) => {
                  e.preventDefault();
                  if (!isHost) return;
                  setIsChangingSet(true);
                }}
              >
                {roomState.set.img ? (
                  <Image
                    alt={roomState.set.name + "photo"}
                    src={roomState.set.img}
                    width={500}
                    height={500}
                    className="h-20 w-20 rounded-lg"
                  />
                ) : (
                  <div> </div>
                )}
                <div className="h-full w-full">
                  <h3 className="text-xl font-semibold">
                    {roomState.set.name}
                  </h3>
                  <p className="text-lg">
                    By user: {roomState.set.creatorName}
                  </p>
                  <p className="text-lg">{roomState.set.plays} plays</p>
                </div>
              </div>
            ) : (
              <div className="border-muted flex h-24 w-full flex-row items-center justify-center gap-3 rounded-xl border px-5 py-2 hover:cursor-pointer hover:bg-zinc-700">
                <div className="border-secondary flex h-20 w-20 items-center justify-center rounded-lg border">
                  <Video />
                </div>
                <div className="h-full w-full">
                  <h3 className="text-xl font-semibold">
                    Waiting for host to choose set
                  </h3>
                </div>
              </div>
            )}

            <h2 className="text-lg font-semibold">
              Players ({roomState.players.filter((p) => p.connected).length}/
              {roomState.players.length})
            </h2>
            <Separator />
            {roomState.players.map((player) => (
              <div key={player.id} className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-xl font-semibold",
                    player.connected
                      ? ""
                      : "text-muted-foreground line-through",
                  )}
                >
                  {player.name}
                </span>
                {player.id === roomState.hostId && (
                  <span className="text-base text-yellow-500">★ Host</span>
                )}
                {!player.connected && (
                  <span className="text-xs text-red-400">disconnected</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex h-full w-full flex-col items-center">
            {!roomState.set && !isHost ? (
              <Loading
                message="Waiting for host to select character set..."
                className="m-auto"
              />
            ) : !roomState.set || changingSet ? (
              <SelectAnimeSet />
            ) : (
              <div className="flex h-full w-full justify-center gap-6">
                <SetVisualizer className="" set={roomState.set} />
              </div>
            )}
          </div>
          <Chat className="h-192 w-120" />
        </div>

        <div className="mt-5 flex justify-between gap-2">
          <Button variant="destructive" onClick={leaveRoom}>
            Leave Room
          </Button>
          {isHost && roomState.status === "waiting" && (
            <Button onClick={() => startGame()} className="text-xl font-bold">
              Start Game
            </Button>
          )}
        </div>

        {roomState.status === "playing" && (
          <Button onClick={() => router.push("/play")}>Go to Game</Button>
        )}
      </div>
    </div>
  );
}

function SelectAnimeSet() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const {
    roomId,
    playerName,
    roomState,
    connected,
    error,
    playerId,
    isHost,
    leaveRoom,
    startGame,
    selectSet,
  } = useParty();

  const { data: sets, isLoading } = api.sets.getAnimeSets.useQuery({
    search: query,
  });

  useEffect(() => {
    setTimeout(() => {
      setQuery(search);
    }, 500);
  }, [search]);

  const set = roomState!.set;

  return (
    <div className="h-full w-full flex-col gap-3">
      <ButtonGroup className="mb-5 w-full">
        <Input
          placeholder="Search for character set..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full"
          maxLength={45}
        />
        <Button className="hover:cursor-pointer" variant="secondary">
          Search
        </Button>
      </ButtonGroup>
      <div className="flex h-[60vh] flex-col gap-3">
        {isLoading ? (
          <Loading
            message="Loading character sets..."
            className="h-full w-full"
          />
        ) : sets && sets.length > 0 ? (
          sets.map((s) => (
            <div
              key={s.id}
              className="border-muted flex h-24 flex-row gap-3 rounded-xl border px-5 py-2 hover:cursor-pointer hover:bg-zinc-700"
              onClick={(e) => {
                e.preventDefault();
                if (roomState?.set?.id === s.id) return;
                selectSet(s.id);
              }}
            >
              {s.img ? (
                <Image
                  alt={s.name + "photo"}
                  src={s.img}
                  width={500}
                  height={500}
                  className="h-20 w-20 rounded-lg"
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
      </div>
    </div>
  );
}
