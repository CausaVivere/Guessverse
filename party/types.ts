// Shared types between party server and client

import type { AnimeGameSet } from "~/server/api/utils/jikan";

// Messages sent FROM clients TO the server
export type ClientMessage =
  | { type: "join"; playerName: string; playerId: string }
  | { type: "start-game" }
  | { type: "selected-set"; setId: string }
  | { type: "turnCard"; playerId: string; characterId: number }
  | { type: "guess"; characterId: number }
  | { type: "endTurn" };

// Messages sent FROM the server TO clients
export type ServerMessage =
  | { type: "room-state"; state: RoomState }
  | { type: "player-joined"; player: Player }
  | { type: "player-left"; playerId: string }
  | { type: "game-started" }
  | { type: "error"; message: string };

export type Player = {
  id: string; // stable player ID (generated client-side, persisted in sessionStorage)
  connectionId: string; // current WebSocket connection ID (changes on reconnect)
  name: string;
  score: number;
  connected: boolean;
  characterToGuess: number | null;
  turnt: number[];
};

export type RoomState = {
  players: Player[];
  hostId: string | null; // stable player ID of the host
  status: "waiting" | "playing" | "finished";
  set: AnimeGameSet | null;
  turn: string | null; // stable player ID of the current turn
  // Turn timer
  turnDurationMs: number; // configurable turn duration
  turnEndsAt: number | null; // epoch ms when current turn ends
  timeRemainingMs: number | null; // server-computed remaining time (updated every second)
};
