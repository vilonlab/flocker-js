# Flocker

An online multiplayer experiment built with **Phaser 3** (client) and **Colyseus** (Node.js/TypeScript server) for real-time communication and state management. Players move around a shared arena, try to reach a target zone, and emote at each other, while the server logs round-by-round state to SQLite for later analysis.

## Project Structure

```
flocker-js/
├── client/                    # Phaser front end, built with Parcel
│   ├── index.html
│   └── src/
│       ├── main.ts            # Phaser game bootstrap
│       ├── backend.ts         # Colyseus client connection
│       ├── config.ts          # Client-side tuning constants
│       ├── TextureManager.ts  # Loads swappable asset "packs"
│       ├── scenes/
│       │   ├── MMScene.ts     # Matchmaking / connecting screen
│       │   ├── LobbyScene.ts  # Pre-round lobby
│       │   ├── GameScene.ts   # Main gameplay (movement, zones, emotes, spectator view)
│       │   └── EndScene.ts    # Post-experiment summary
│       └── assets/
│           └── packs/         # Texture packs (default, space, ...)
│
├── server/                    # Colyseus server
│   └── src/
│       ├── index.ts           # Server entry point
│       ├── app.config.ts      # Express routes, admin API, Colyseus wiring
│       ├── config.ts          # Server-side game/round/scoring tuning
│       ├── rooms/
│       │   ├── experimentRoom.ts       # Core room: lobby, rounds, scoring, spectators
│       │   └── schema/experimentSchema.ts
│       ├── scoring/            # Pluggable scoring strategies
│       ├── spectatorTokens.ts  # Short-lived tokens gating admin spectator joins
│       ├── dataLogger.ts       # Batched SQLite (better-sqlite3) snapshot logging
│       └── views/              # Static admin pages (rooms list, data export, clients display)
│
├── deploy/                     # Deployment templates (nginx, oauth2-proxy, pm2, backups)
└── README.md
```

## Features

* Real-time multiplayer via **Colyseus** rooms and schema-based state sync.
* Round-based gameplay: players move with arrow keys, emote with keys 1-4, and try to reach the correct target zone before the round timer runs out.
* A configurable proportion of "aware" players per round which can grow over rounds or be re-randomized each round.
* Pluggable scoring strategies with player-facing descriptions of the current scoring rule.
* Matchmaking lobby that waits for a minimum number of players, followed by an instructions phase and round countdowns.
* Player collision and speech-bubble emote rendering, with distinct per-player colors and names.
* **Admin spectator mode**: an admin room-list page (`/admin/rooms`) shows in-progress rooms and lets an admin join any of them as a read-only spectator.
* Additional admin pages for viewing currently connected clients and exporting logged data as CSV.
* Snapshot-based data logging to SQLite (batched/queued writes).

## Database Schema & Experiment Data

The server persists to a SQLite database at `server/data/flocker.db` (WAL mode, via `better-sqlite3`), managed by the `DataLogger` singleton in `server/src/dataLogger.ts`. All rooms share one connection; snapshots are queued in memory and flushed in a single batch transaction every 50 snapshots or every 1 second, whichever comes first.

### `snapshots` table

This is the primary output of an experiment: one row per captured game-state snapshot. Rows are only logged while a room's phase is `ACTIVE`, both on a fixed timer (`config.logging.snapshotInterval`, default every 100ms) and once more right before each state patch is broadcast to clients (~20/sec), so density varies a bit depending on how active a round is.

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Autoincrement row id |
| `timestamp` | INTEGER | Colyseus simulation clock time (ms) at capture |
| `server_time` | INTEGER | Real-world `Date.now()` at capture |
| `room_id` | TEXT | Colyseus room id |
| `phase` | TEXT | Room phase at capture (see enum below), may be `NULL` |
| `target_zone` | TEXT | The round's correct zone id, may be `NULL` |
| `players` | JSON | Array of per-player state at capture time (see below) |
| `created_at` | DATETIME | SQLite insert time |

Each entry in the `players` JSON array:

* `id` — Colyseus `sessionId`
* `x`, `y` — position (rounded to the nearest pixel on patch-triggered snapshots)
* `aware` — whether the player currently knows the correct target zone
* `name`, `color`, `textColor` — display identity
* `emote` — currently active emote symbol, or empty string
* `zone` — id of the zone the player is currently standing in, or `-1`
* `points` — player's cumulative score
* `ready` — lobby ready-up state

Phase enum values (`server/src/rooms/schema/experimentSchema.ts`): `ACTIVE`, `WAITING`, `SCOREBOARD`, `LOBBY`, `END`, `INSTRUCTION`, `COUNTDOWN`.

Note: rows don't store a round number directly, so round boundaries need to be reconstructed from `target_zone` changes and phase transitions in the snapshot stream for a given `room_id`.

### `player_data` table

Also defined in the schema (`id`, `name`, `color`, `text_color`, `points`, `last_connection`), intended to track a player across reconnects, but its write path (`updatePlayerData`) is currently commented out in `dataLogger.ts` — this table is not populated in the current build.

### Exporting data

The admin data-extraction page (`/admin/data`, backed by `GET /admin/api/data`) queries `snapshots` filtered by an optional date range and downloads the results as CSV, with the `players` column flattened to a JSON string per row.

## Installation

1. Clone the repository.
2. Install server dependencies:
   ```bash
   cd server
   npm install
   ```
3. Install client dependencies:
   ```bash
   cd ../client
   npm install
   ```
It is recommended to use nginx as a web server/proxy, pm2 to manage the backend Node process, and oauth2-proxy to manage gated administrator pages. Deployment templates are included in the repository in the `deploy/` directory.

*(Detailed run/build/deploy instructions to come.)*
