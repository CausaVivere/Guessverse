// Shared types between party server and client

// Messages sent FROM clients TO the server
export type ClientMessage =
  | { type: "join"; playerName: string }
  | { type: "start-game" }
  | { type: "guess"; characterId: number };

// Messages sent FROM the server TO clients
export type ServerMessage =
  | { type: "room-state"; state: RoomState }
  | { type: "player-joined"; player: Player }
  | { type: "player-left"; playerId: string }
  | { type: "error"; message: string };

export type Player = {
  id: string;
  name: string;
  score: number;
};

export type RoomState = {
  players: Player[];
  hostId: string | null;
  status: "waiting" | "playing" | "finished";
};
