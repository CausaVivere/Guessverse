import type * as Party from "partykit/server";
import {
  type ClientMessage,
  type ServerMessage,
  type Player,
  type RoomState,
  type Message,
  playerColors,
} from "./types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";
const MAX_PLAYERS = 8;
const DEFAULT_MAX_GAME_DURATION_MS = 30 * 60 * 1000;
const DEFAULT_MAX_TURNS = 100;

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
    gameStartedAt: null,
    maxGameDurationMs: DEFAULT_MAX_GAME_DURATION_MS,
    maxTurns: DEFAULT_MAX_TURNS,
    turnCount: 0,
    chat: [],
    winnerId: null,
    drawReason: null,
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
      case "sendMessage":
        this.handleSendMessage(sender, msg.message);
        break;
      case "makeGuess":
        this.handleMakeGuess(sender, msg.characterId);
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

    // If host disconnected, assign new host
    if (this.state.hostId === playerId) {
      const nextHost = this.state.players.find((p) => p.connected);
      this.state.hostId = nextHost?.id ?? null;
    }

    // If all players disconnected, fully reset room state.
    // PartyKit will hibernate/evict idle rooms; this ensures clean joins.
    if (this.state.players.filter((p) => p.connected).length === 0) {
      this.stopTurnTimer();
      this.connections.clear();
      this.resetRoomState();
      this.broadcast({ type: "room-state", state: this.state });
      return;
    }

    const remaining = this.state.players.filter(
      (p) => p.connected && !p.eliminated,
    );
    // If the disconnected player was still in the game, check if we need to end or advance the turn
    if (remaining.length === 1 && this.state.status === "playing") {
      const lastPlayer = remaining[0]!;
      this.state.winnerId = lastPlayer.id;
      this.state.players = this.state.players.map((p) =>
        p.id === lastPlayer.id ? { ...p, score: p.score + 1 } : p,
      );
      this.broadcast({ type: "room-state", state: this.state });
      this.delayRestart();
      return;
    }

    if (this.state.turn === playerId) {
      this.advanceTurn();
    }

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

    if (this.state.players.length >= MAX_PLAYERS) {
      this.send(conn, {
        type: "error",
        message: `Room is full (max ${MAX_PLAYERS} players)`,
      });
      this.connections.delete(conn.id);
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
      eliminated: false,
      color: this.pickColor(),
    };
    this.state.players.push(player);

    // Broadcast full state so all clients get hostId + players in sync
    this.broadcast({ type: "room-state", state: this.state });
  }

  private handleStartGame(conn: Party.Connection) {
    this.resetPlayerStates();

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
      player.eliminated = false;
    }

    this.state.set.characters = shuffle(this.state.set.characters);

    const connectedPlayers = this.state.players.filter((p) => p.connected);
    this.state.turn =
      connectedPlayers[Math.floor(Math.random() * connectedPlayers.length)]
        ?.id ?? null;
    this.state.status = "playing";
    this.state.gameStartedAt = Date.now();
    this.state.turnCount = this.state.turn ? 1 : 0;
    this.state.drawReason = null;

    // Initialize turn end; clients compute the remaining seconds locally.
    this.state.turnEndsAt = Date.now() + this.state.turnDurationMs;
    this.state.timeRemainingMs = null;

    this.state.winnerId = null;

    void fetch(
      `${APP_URL}/api/internal/set/${encodeURIComponent(this.state.set.id)}`,
      {
        method: "POST",
        headers: { "x-internal-secret": INTERNAL_SECRET },
      },
    ).then((res) => {
      if (!res.ok) {
        this.send(conn, { type: "error", message: "Character set not found" });
        return;
      }
    });

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

    if (this.isDrawByGameDuration()) {
      this.endAsDraw("time-limit");
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

    // Server stays authoritative, but clients can compute the countdown locally.
    // Only broadcast when the turn actually changes.
    if (now >= endsAt) {
      this.advanceTurn();
      this.broadcast({ type: "room-state", state: this.state });
    }
  }

  private advanceTurn() {
    if (this.state.status !== "playing") return;

    if (this.state.turnCount >= this.state.maxTurns) {
      this.endAsDraw("turn-limit");
      return;
    }

    const connected = this.state.players.filter((p) => p.connected);
    const active = connected.filter((p) => !p.eliminated);

    if (active.length === 0) {
      this.state.turn = null;
      this.state.turnEndsAt = null;
      this.state.timeRemainingMs = null;
      return;
    }

    // Keep connected-player seat order and skip eliminated players.
    const currentIndex = connected.findIndex((p) => p.id === this.state.turn);
    if (currentIndex === -1) {
      this.state.turn = active[0]!.id;
    } else {
      let nextTurnId: string | null = null;
      for (let offset = 1; offset <= connected.length; offset += 1) {
        const candidate = connected[(currentIndex + offset) % connected.length];
        if (candidate && !candidate.eliminated) {
          nextTurnId = candidate.id;
          break;
        }
      }
      this.state.turn = nextTurnId ?? active[0]!.id;
    }
    this.state.turnCount += 1;
    this.state.turnEndsAt = Date.now() + this.state.turnDurationMs;
    this.state.timeRemainingMs = null;

    this.broadcast({ type: "room-state", state: this.state });
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

  private handleSendMessage(conn: Party.Connection, message: string) {
    const player = this.state.players.find((p) => p.connectionId === conn.id);
    if (!player) return;

    if (!message.trim()) return;
    if (message.length > 200) {
      message = message.substring(0, 200);
    }
    // Broadcast the new message to all clients
    const chatMessage: Message = {
      id: this.generateId(),
      senderId: player.id,
      content: message,
      timestamp: Date.now(),
    };
    this.state.chat.push(chatMessage);
    this.broadcast({ type: "room-state", state: this.state });
  }

  private handleMakeGuess(conn: Party.Connection, characterId: number) {
    const player = this.state.players.find((p) => p.connectionId === conn.id);
    if (!player) return;

    if (!this.state.turn || player.id !== this.state.turn) {
      this.send(conn, {
        type: "error",
        message: "It's not your turn",
      });
      return;
    }

    // Check if the guess is correct
    const character = this.state.set?.characters.find(
      (c) => c.id === characterId,
    );
    if (!character) return;

    if (character.id === player.characterToGuess) {
      this.state.status = "finished";
      this.state.winnerId = player.id;
      this.state.players = this.state.players.map((p) =>
        p.id === player.id ? { ...p, score: p.score + 1 } : p,
      );
      this.broadcast({ type: "room-state", state: this.state });
      this.delayRestart();
    } else {
      this.state.players = this.state.players.map((p) =>
        p.id === player.id ? { ...p, eliminated: true } : p,
      );

      if (this.state.players.filter((p) => !p.eliminated).length === 1) {
        const survivingPlayer =
          this.state.players.find((p) => !p.eliminated) ?? null;

        this.state.status = "finished";
        this.state.winnerId = survivingPlayer?.id ?? null;

        if (survivingPlayer) {
          this.state.players = this.state.players.map((p) =>
            p.id === survivingPlayer.id ? { ...p, score: p.score + 1 } : p,
          );
        }

        this.broadcast({ type: "room-state", state: this.state });
        this.broadcast({
          type: "last-player-standing",
          winner: survivingPlayer?.name ?? "Unknown",
          loser: player.name,
          guessedCharacterId: character.id,
        });
        this.delayRestart();
        return;
      }

      this.state.turnEndsAt = Date.now() + this.state.turnDurationMs; // reset turn timer on incorrect guess
      this.state.players = this.state.players.map((p) =>
        p.id === player.id ? { ...p, eliminated: true } : p,
      );
      this.advanceTurn();
      this.broadcast({ type: "room-state", state: this.state });
      this.broadcast({
        type: "incorrect-guess",
        message: `${player.name} guessed wrong and was eliminated!`,
        characterId: character.id,
        playerId: player.id,
        playerName: player.name,
      });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────
  private send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage) {
    this.room.broadcast(JSON.stringify(msg));
  }

  private generateId() {
    return crypto.randomUUID();
  }

  private delayRestart() {
    this.stopTurnTimer();
    setTimeout(() => {
      this.state.status = "waiting";
      this.broadcast({ type: "room-state", state: this.state });
    }, 3000);
  }

  private resetPlayerStates() {
    this.state.players = this.state.players.map((p) => ({
      ...p,
      characterToGuess: null,
      turnt: [],
      eliminated: false,
    }));
  }

  private resetRoomState() {
    this.state.players = [];
    this.state.hostId = null;
    this.state.status = "waiting";
    this.state.set = null;
    this.state.turn = null;
    this.state.turnEndsAt = null;
    this.state.timeRemainingMs = null;
    this.state.gameStartedAt = null;
    this.state.turnCount = 0;
    this.state.chat = [];
    this.state.winnerId = null;
    this.state.drawReason = null;
  }

  private isDrawByGameDuration() {
    if (!this.state.gameStartedAt) return false;
    const elapsed = Date.now() - this.state.gameStartedAt;
    return elapsed >= this.state.maxGameDurationMs;
  }

  private endAsDraw(reason: "turn-limit" | "time-limit") {
    this.state.status = "finished";
    this.state.winnerId = null;
    this.state.drawReason = reason;
    this.stopTurnTimer();
    this.broadcast({ type: "room-state", state: this.state });
    this.delayRestart();
  }

  private pickColor(): string {
    const usedColors = new Set(this.state.players.map((p) => p.color));
    const available = playerColors.filter((c) => !usedColors.has(c));
    return (
      available[Math.floor(Math.random() * available.length)] || "gray-500"
    );
  }
}

GameRoom satisfies Party.Worker;

function shuffle(array: Array<any>) {
  return array.sort(() => Math.random() - 0.5);
}
