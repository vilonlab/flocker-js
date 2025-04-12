# Flocker

This project implements an online multiplayer experiment using Phaser.js (frontend) and **Colyseus** (Node.js backend framework) for real-time communication and state management. It is designed for deployment on Railway.

## Project Structure

```
/collective-decision-experiment-colyseus/
├── client/                 # Phaser frontend code (served by Node.js)
│   ├── index.html          # Main HTML file (Colyseus client, UI)
│   ├── main.js             # Phaser initialization
│   ├── assets/             # Images, spritesheets
│   └── src/
│       └── scenes/         # Phaser scenes (PreloadScene, GameScene)
│
├── server/                 # Node.js backend code (Colyseus)
│   ├── index.js            # Main server entry point (sets up Colyseus)
│   ├── rooms/              # Colyseus room logic
│   │   ├── ExperimentRoom.js # Main game/lobby/round logic room
│   │   └── schema/         # Colyseus state schemas
│   │       └── ExperimentRoomState.js # State definitions
│   ├── dataLogger.js       # Data saving utility
│   └── utils.js            # Helper functions
│
├── .gitignore              # Git ignore file
├── package.json            # Dependencies (Node.js, Colyseus, Phaser)
├── package-lock.json       # Exact dependency versions
├── Procfile                # Railway process definition
└── README.md               # This file
```

## Features

* Real-time multiplayer interaction via WebSockets managed by **Colyseus**.
* **Colyseus Room** (`ExperimentRoom`) handling game logic, player connections, lobby management, instructions phase, round progression, roles, and scoring.
* **Colyseus State Synchronization** using schema (`ExperimentRoomState`) to automatically keep clients updated on game state (phase, players, positions, emotes, scores, etc.).
* Phaser.js client for rendering the game arena, players, zones, and emotes, reacting to state changes.
* Lobby system with player list and optional readiness checks.
* Instructions phase before rounds begin.
* Players move by clicking, emote using keys 1-4.
* Round-based structure with varying numbers of "informed" players per round.
* Data logging (player positions, emotes, roles, zone entry) round-by-round to a persistent JSON Lines file (`experiment_data_colyseus.jsonl`).
* Designed for deployment on Railway (uses `PORT` environment variable, `Procfile`, persistent volume for logs).
* Optional Colyseus Monitor for debugging server state (if enabled in `server/index.js`).
* Basic admin controls (start experiment) available to the first player joining the room.

## Setup

1.  **Prerequisites:**
    * Node.js (version specified in `package.json`, e.g., v18 or later)
    * npm (usually comes with Node.js)
    * Git

2.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd flocker-js
    ```

3.  **Install dependencies:**
    ```bash
    npm install
    ```
    *(This installs Express, Colyseus, Phaser (via CDN in client), and other necessary packages listed in `package.json`)*

4.  **Assets:** (Optional - Placeholders will be generated if missing)
    * Place your `player.png`, `zone.png`, and `emotes.png` (e.g., 32x32 frames for `!`,`+`,`x`,`?`) files inside the `client/assets/` directory.

## Running Locally

1.  **Start the server:**
    ```bash
    npm start
    ```
    * Or use `npm run dev` if you installed `nodemon` for auto-reloading during development.

2.  **Access the experiment:**
    * Open your web browser and navigate to `http://localhost:3000` (or the port specified in the console).

3.  **Colyseus Monitor (Optional):**
    * If enabled in `server/index.js` (usually default for non-production), access the monitor at `http://localhost:3000/colyseus` to inspect rooms and state.

4.  **Interact:**
    * Open multiple browser tabs/windows to simulate multiple players joining the Colyseus room.
    * Follow the on-screen prompts (Lobby -> Instructions -> Gameplay).
    * Use the "Ready" button in the lobby (if implemented/required).
    * The **first player** to join typically has admin controls (bottom-left) to "Start Experiment" when in the lobby phase.
    * Click to move your player during active rounds.
    * Press keys 1-4 to emote.

5.  **Data:**
    * During rounds, data will be logged to `experiment_data_colyseus.jsonl` in the project's root directory when run locally.

## Deployment to Railway

1.  **Create a GitHub Repository:** Push your project code to a new GitHub repository.

2.  **Create a Railway Project:**
    * Go to [Railway.app](https://railway.app/) and sign up or log in.
    * Click "New Project" -> "Deploy from GitHub repo".
    * Select your GitHub repository. Railway will detect the `Node.js` project and `Procfile`.

3.  **Configure Environment Variables (if needed):**
    * Railway automatically sets the `PORT` variable.
    * You might set `NODE_ENV=production` to disable the Colyseus monitor on deployment.

4.  **Add a Persistent Volume:**
    * Go to your service settings in the Railway project dashboard.
    * Navigate to the "Volumes" tab.
    * Click "Add Volume".
    * Set the **Mount Path** to `/data`. This matches the path used in `server/dataLogger.js`. **This is crucial for saving data across deployments/restarts.**

5.  **Deploy:**
    * Railway should automatically build and deploy your project based on the `Procfile` (`web: node server/index.js`). Monitor the build and deployment logs.

6.  **Access:**
    * Once deployed, Railway will provide a public URL (e.g., `your-project-name.up.railway.app`). Use this URL to access the experiment. The Colyseus WebSocket server will run on the same domain/port.

7.  **Retrieve Data:**
    * You can access the persistent volume data (`/data/experiment_data_colyseus.jsonl`) through the Railway dashboard or using the Railway CLI. Check the Railway documentation for details on accessing volume data.

## Data Format (`experiment_data_colyseus.jsonl`)

Data is saved in JSON Lines format. Each line is a valid JSON object representing a recorded event or state snapshot. Example entries:

```json
{"eventType":"session_start","timestamp":1712964000000}
{"timestamp":1712964061500,"round":1,"playerId":"clientSessionId1","role":"informed","x":410,"y":305,"emote":null,"targetX":650,"targetY":300,"isInTargetZone":false,"currentZone":null,"isFinalState":false}
{"timestamp":1712964062000,"round":1,"playerId":"clientSessionId2","role":"uninformed","x":400,"y":300,"emote":"?","eventType":"emote"}
{"timestamp":1712964062500,"round":1,"playerId":"clientSessionId1","role":"informed","x":425,"y":303,"emote":null,"targetX":650,"targetY":300,"isInTargetZone":false,"currentZone":null,"isFinalState":false}
{"timestamp":1712964120000,"round":1,"playerId":"clientSessionId1","role":"informed","x":648,"y":301,"emote":null,"targetX":null,"targetY":null,"isInTargetZone":true,"currentZone":"Right","isFinalState":true}
{"timestamp":1712964120000,"round":1,"playerId":"clientSessionId2","role":"uninformed","x":510,"y":280,"emote":null,"targetX":null,"targetY":null,"isInTargetZone":false,"currentZone":null,"isFinalState":true}
```

*(Note: Timestamps are examples)*

Fields include:
* `timestamp`: Milliseconds since epoch (from Colyseus clock).
* `round`: Current round number.
* `playerId`: Colyseus client `sessionId`.
* `role`: 'informed' or 'uninformed'.
* `x`, `y`: Player's position (requires client to send updates for accuracy).
* `emote`: Currently displayed emote symbol (or `null`).
* `targetX`, `targetY`: The player's current movement target (or `null`).
* `isInTargetZone`: Boolean, true if player is inside the *correct* zone for the round.
* `currentZone`: The key ('Top', 'Right', 'Bottom', 'Left') of the zone the player is currently in (or `null`).
* `isFinalState`: Boolean, true if this log entry represents the state at the very end of the round.
* `emoteAction`: Present when an emote key is pressed, logs the specific emote triggered.
* `eventType`: Can indicate special events like 'session_start' or 'emote'.

## Notes & Considerations

* **Colyseus vs. Socket.IO:** Colyseus provides higher-level abstractions for room management and state synchronization compared to raw Socket.IO, simplifying server logic but introducing its own framework concepts.
* **Server Authority:** For accurate logging and scoring, the server (`ExperimentRoom.js`) needs reliable player position data (`player.x`, `player.y`). The current client implementation sends movement *intent* (`playerMovement`). For higher accuracy, the client *must* send frequent position updates (`positionUpdate` message, needs handler added in `ExperimentRoom.js`) while moving, and the server should update its state accordingly.
* **Scalability:** Colyseus is designed for scalability, but the specific limits depend on server resources and the complexity of the room logic/state.
* **Error Handling:** Robust error handling (network issues, server restarts, invalid messages) is recommended for production experiments.
* **Security:** Admin controls are basic (first player). Real experiments might need more robust authorization. Input validation should be thorough.
```