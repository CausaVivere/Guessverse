import type * as Party from "partykit/server";
import type { ClientMessage, ServerMessage, Player, RoomState } from "./types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

// Maps connectionId → stable playerId for disconnect handling
type ConnectionMap = Map<string, string>;

// ─── Server ──────────────────────────────────────────────────────
export default class GameRoom implements Party.Server {
  state: RoomState = {
    players: [],
    hostId: null,
    status: "waiting",
    set: null,
    turn: null,
    turnDurationMs: 45_000,
    turnEndsAt: null,
    timeRemainingMs: null,
  };

  private tickInterval: ReturnType<typeof setInterval> | null = null;

  // Track which connection belongs to which player
  connections: ConnectionMap = new Map();

  constructor(readonly room: Party.Room) {}

  // -- A player connects via WebSocket --
  onConnect(conn: Party.Connection) {
    // Don't assign host here — wait for the "join" message
    // which carries the stable playerId
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
        this.handleJoin(sender, msg.playerId, msg.playerName);
        break;
      case "start-game":
        this.handleStartGame(sender);
        break;
      case "turnCard":
        this.handleTurn(sender, msg.playerId, msg.characterId);
        break;
      case "endTurn":
        this.handleEndTurn(sender);
        break;
      case "selected-set":
        this.handleSelectSet(sender, msg.setId);
        break;
      case "guess":
        // TODO: handle guess logic
        break;
    }
  }

  // -- A player disconnects --
  onClose(conn: Party.Connection) {
    const playerId = this.connections.get(conn.id);
    if (!playerId) return;

    this.connections.delete(conn.id);

    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;

    // Mark as disconnected instead of removing — allows reconnection
    player.connected = false;
    player.connectionId = "";

    this.broadcast({ type: "room-state", state: this.state });
  }

  onDestroy() {
    this.stopTurnTimer();
  }

  // ─── Handlers ────────────────────────────────────────────────
  private handleJoin(conn: Party.Connection, playerId: string, name: string) {
    // Track this connection → player mapping
    this.connections.set(conn.id, playerId);

    // First player becomes host
    if (!this.state.hostId) {
      this.state.hostId = playerId;
    }
    // Check if this player already exists (reconnection)
    const existing = this.state.players.find((p) => p.id === playerId);

    if (existing) {
      // Reconnection — update their connection ID and mark as connected
      existing.connectionId = conn.id;
      existing.connected = true;
      existing.name = name; // allow name updates

      this.broadcast({ type: "room-state", state: this.state });
      return;
    }

    // New player — only allowed during waiting
    if (this.state.status !== "waiting") {
      this.send(conn, { type: "error", message: "Game already in progress" });
      return;
    }

    const player: Player = {
      id: playerId,
      connectionId: conn.id,
      name,
      score: 0,
      connected: true,
      characterToGuess: null,
      turnt: [],
    };
    this.state.players.push(player);

    // Broadcast full state so all clients get hostId + players in sync
    this.broadcast({ type: "room-state", state: this.state });
  }

  private handleStartGame(conn: Party.Connection) {
    const playerId = this.connections.get(conn.id);

    // Only the host can start
    if (playerId !== this.state.hostId) {
      this.send(conn, {
        type: "error",
        message: "Only the host can start the game",
      });
      return;
    }

    const connectedCount = this.state.players.filter((p) => p.connected).length;
    if (connectedCount < 2) {
      this.send(conn, {
        type: "error",
        message: "Need at least 2 connected players to start",
      });
      return;
    }

    if (!this.state.set) {
      this.send(conn, {
        type: "error",
        message: "Character set not selected",
      });
      return;
    }

    let chars = [...this.state.set.characters];

    for (const player of this.state.players) {
      if (!player.connected) continue;
      chars = shuffle(chars);
      // Assign a random character to each player
      player.characterToGuess = chars.pop()?.id || null;
    }

    this.state.set.characters = shuffle(this.state.set.characters);

    const connectedPlayers = this.state.players.filter((p) => p.connected);
    this.state.turn =
      connectedPlayers[Math.floor(Math.random() * connectedPlayers.length)]
        ?.id ?? null;
    this.state.status = "playing";

    // Start the turn timer loop.
    this.startTurnTimer();
    this.broadcast({ type: "room-state", state: this.state });
  }

  private async handleSelectSet(conn: Party.Connection, setId: string) {
    const playerId = this.connections.get(conn.id);
    if (!playerId) return;

    // Only the host can select the set
    if (playerId !== this.state.hostId) {
      this.send(conn, {
        type: "error",
        message: "Only the host can select the character set",
      });
      return;
    }

    try {
      const res = await fetch(
        `${APP_URL}/api/internal/set/${encodeURIComponent(setId)}`,
        { headers: { "x-internal-secret": INTERNAL_SECRET } },
      );

      if (!res.ok) {
        this.send(conn, { type: "error", message: "Character set not found" });
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const set = await res.json();
      this.state.set = set;
      this.broadcast({ type: "room-state", state: this.state });
    } catch {
      this.send(conn, {
        type: "error",
        message: "Failed to load character set",
      });
    }
  }

  private handleTurn(
    conn: Party.Connection,
    playerId: string,
    characterId: number,
  ) {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return;

    // Check if it's the player's turn
    if (player.id !== this.state.turn) {
      this.send(conn, {
        type: "error",
        message: "It's not your turn",
      });
      return;
    }

    if (player.turnt.includes(characterId)) {
      player.turnt = player.turnt.filter((id) => id !== characterId);
    } else {
      // Update the player's turn history
      player.turnt.push(characterId);
    }

    // Broadcast the updated state
    this.broadcast({ type: "room-state", state: this.state });
  }

  // ─── Turn timer / round robin ───────────────────────────────
  private startTurnTimer() {
    // Only run timer during active game
    if (this.state.status !== "playing") return;

    // Ensure fixed duration is set (can be made configurable later)
    if (!this.state.turnDurationMs || this.state.turnDurationMs < 5_000) {
      this.state.turnDurationMs = 45_000;
    }

    // Initialize turn end
    if (!this.state.turnEndsAt) {
      this.state.turnEndsAt = Date.now() + this.state.turnDurationMs;
    }

    this.stopTurnTimer();
    this.tickInterval = setInterval(() => this.tickTurnTimer(), 1000);
  }

  private stopTurnTimer() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private tickTurnTimer() {
    if (this.state.status !== "playing") {
      this.stopTurnTimer();
      return;
    }

    const now = Date.now();
    const endsAt = this.state.turnEndsAt;

    if (!endsAt || !this.state.turn) {
      // Recover if state got into a bad spot
      this.advanceTurn();
      this.broadcast({ type: "room-state", state: this.state });
      return;
    }

    const remaining = Math.max(0, endsAt - now);
    this.state.timeRemainingMs = remaining;

    if (remaining <= 0) {
      this.advanceTurn();
    }

    // Per requirement: update all clients every second.
    this.broadcast({ type: "room-state", state: this.state });
  }

  private advanceTurn() {
    const connected = this.state.players.filter((p) => p.connected);
    if (connected.length === 0) {
      this.state.turn = null;
      this.state.turnEndsAt = null;
      this.state.timeRemainingMs = null;
      return;
    }

    // If current turn player disconnected, or we just ended the turn, go next.
    const currentIndex = connected.findIndex((p) => p.id === this.state.turn);
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % connected.length;
    this.state.turn = connected[nextIndex]?.id ?? connected[0]!.id;
    this.state.turnEndsAt = Date.now() + this.state.turnDurationMs;
    this.state.timeRemainingMs = this.state.turnDurationMs;
  }

  private handleEndTurn(conn: Party.Connection) {
    const player = this.state.players.find((p) => p.connectionId === conn.id);
    if (!player) return;

    // If it's not the player's turn, ignore
    if (player.id !== this.state.turn) {
      this.send(conn, {
        type: "error",
        message: "It's not your turn",
      });
      return;
    }

    // Advance the turn
    this.advanceTurn();
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

function shuffle(array: Array<any>) {
  return array.sort(() => Math.random() - 0.5);
}
