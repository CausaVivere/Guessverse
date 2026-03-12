import type * as Party from "partykit/server";
import type { ClientMessage, ServerMessage, Player, RoomState } from "./types";

// ─── Server ──────────────────────────────────────────────────────
export default class GameRoom implements Party.Server {
  state: RoomState = {
    players: [],
    hostId: null,
    status: "waiting",
  };

  constructor(readonly room: Party.Room) {}

  // -- A player connects via WebSocket --
  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // Send them the current room state immediately
    this.send(conn, { type: "room-state", state: this.state });
  }

  // -- A player sends a message --
  onMessage(raw: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case "join":
        this.handleJoin(sender, msg.playerName);
        break;
      case "start-game":
        this.handleStartGame(sender);
        break;
      case "guess":
        // TODO: handle guess logic
        break;
    }
  }

  // -- A player disconnects --
  onClose(conn: Party.Connection) {
    const player = this.state.players.find((p) => p.id === conn.id);
    if (!player) return;

    this.state.players = this.state.players.filter((p) => p.id !== conn.id);

    // If the host left, assign a new host
    if (this.state.hostId === conn.id) {
      this.state.hostId = this.state.players[0]?.id ?? null;
    }

    this.broadcast({ type: "player-left", playerId: conn.id });
  }

  // ─── Handlers ────────────────────────────────────────────────
  private handleJoin(conn: Party.Connection, name: string) {
    // Don't allow joining if game already started
    if (this.state.status !== "waiting") {
      this.send(conn, { type: "error", message: "Game already in progress" });
      return;
    }

    // Don't allow duplicate joins
    if (this.state.players.some((p) => p.id === conn.id)) return;

    const player: Player = { id: conn.id, name, score: 0 };
    this.state.players.push(player);

    // First player becomes host
    if (!this.state.hostId) {
      this.state.hostId = conn.id;
    }

    // Tell everyone about the new player
    this.broadcast({ type: "player-joined", player });
  }

  private handleStartGame(conn: Party.Connection) {
    // Only the host can start
    if (conn.id !== this.state.hostId) {
      this.send(conn, {
        type: "error",
        message: "Only the host can start the game",
      });
      return;
    }

    if (this.state.players.length < 2) {
      this.send(conn, {
        type: "error",
        message: "Need at least 2 players to start",
      });
      return;
    }

    this.state.status = "playing";
    this.broadcast({ type: "room-state", state: this.state });
  }

  // ─── Helpers ─────────────────────────────────────────────────
  private send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage) {
    this.room.broadcast(JSON.stringify(msg));
  }
}

GameRoom satisfies Party.Worker;
