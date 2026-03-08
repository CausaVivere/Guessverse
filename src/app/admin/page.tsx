"use client";
import { useState } from "react";
import { Input } from "~/components/ui/input";
import { ButtonGroup } from "~/components/ui/button-group";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { toast } from "sonner";

export default function AdminPage() {
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
    <div className="bg-background flex min-h-screen w-full items-center justify-center">
      <div className="border-foreground flex h-full w-3/5 items-center justify-center rounded-md p-5">
        <ButtonGroup>
          <Input
            placeholder="Search for game..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button
            onClick={(e) => {
              e.preventDefault();
              searchGames.mutate({ search });
            }}
          >
            Search
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}
