const colyseus = require('colyseus');
const { ExperimentRoomState, PlayerState, ZoneState } = require('./schema/ExperimentRoomState');
const DataLogger = require('../dataLogger'); // Assuming dataLogger is compatible or adapted
const { getRandomColor } = require('../utils'); // Assuming utils is compatible

// Define constants for phases, easier to manage
const PHASES = {
    LOBBY: 'lobby',
    INSTRUCTIONS: 'instructions',
    ROUND_STARTING: 'round_starting',
    ROUND_ACTIVE: 'round_active',
    ROUND_END: 'round_end',
    EXPERIMENT_END: 'experiment_end'
};

const ZONE_DEFINITIONS = { // Keep definitions consistent
    Top: { id: 'Top', x: 400, y: 150, radius: 100 },
    Right: { id: 'Right', x: 650, y: 300, radius: 100 },
    Bottom: { id: 'Bottom', x: 400, y: 450, radius: 100 },
    Left: { id: 'Left', x: 150, y: 300, radius: 100 }
};
const ARENA_CENTER = { x: 400, y: 300 };


class ExperimentRoom extends colyseus.Room {

    onCreate(options) {
        console.log("ExperimentRoom created!", options);
        this.setState(new ExperimentRoomState());

        this.maxRounds = 9;
        this.roundDuration = 60 * 1000; // Use milliseconds
        this.roundTimer = null; // Colyseus Clock timer reference
        this.logTimer = null; // Interval timer for logging
        this.dataLogger = new DataLogger('experiment_data_colyseus.jsonl'); // Use a different log file maybe
        this.logInterval = 1000; // ms
        this.playersInZones = {}; // { zoneId: Set<sessionId> }
         this.adminSessionId = null; // Track who can start the game (simple approach)

        // Initialize Zones in state
        for (const zoneKey in ZONE_DEFINITIONS) {
             const zd = ZONE_DEFINITIONS[zoneKey];
             this.state.zones.set(zoneKey, new ZoneState(zd.id, zd.x, zd.y, zd.radius));
             this.playersInZones[zoneKey] = new Set(); // Initialize internal tracking
        }

        // Register message handlers
        this.onMessage("playerMovement", (client, message) => {
            this.handlePlayerMovement(client, message);
        });

        this.onMessage("playerEmote", (client, message) => {
            this.handlePlayerEmote(client, message);
        });

         this.onMessage("setReady", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (player && this.state.phase === PHASES.LOBBY) {
                player.ready = message.isReady !== undefined ? message.isReady : !player.ready;
                console.log(`Player ${client.sessionId} ready state: ${player.ready}`);
                // Check if all players are ready to auto-start instructions (optional)
                // this.checkAllReady();
            }
        });

        this.onMessage("admin_startGame", (client) => {
             // Simple admin check: only first player can start, or designate an admin role
             if (this.adminSessionId === client.sessionId) {
                console.log(`Admin ${client.sessionId} requested game start`);
                this.attemptStartExperiment();
             } else {
                 console.log(`Player ${client.sessionId} attempted admin action without permission.`);
                 client.send("error", "You are not authorized to start the experiment.");
             }
        });

        // Other message handlers (e.g., 'understoodInstructions') can be added here
    }

     // checkAllReady() {
     //    if (this.state.players.size < 1) return false; // Need at least 1 player
     //    let allReady = true;
     //    this.state.players.forEach(player => {
     //        if (!player.ready) allReady = false;
     //    });
     //    if (allReady && this.state.phase === PHASES.LOBBY) {
     //        this.startInstructions();
     //    }
     // }

    attemptStartExperiment() {
         if (this.state.phase === PHASES.LOBBY && this.state.players.size > 0) {
             console.log("Starting Experiment...");
             this.state.roundNumber = 0;
             this.state.score = 0;
             this.dataLogger.startNewLog(); // Clear or prepare log file
             this.startInstructions(); // Go to instructions phase first
         } else {
              console.log("Cannot start game. State:", this.state.phase, "Players:", this.state.players.size);
              const adminClient = this.clients.find(c => c.sessionId === this.adminSessionId);
              if (adminClient) {
                  adminClient.send("error", `Cannot start game. State: ${this.state.phase}, Players: ${this.state.players.size}`);
              }
         }
    }

    startInstructions() {
         console.log("Starting Instructions Phase");
         this.state.phase = PHASES.INSTRUCTIONS;
         this.state.instructionText = "Welcome! In this experiment, you will move your circle using mouse clicks. Use keys 1-4 (!,+,x,?) to communicate. Your goal is to move to the correct zone as a group. Some players might know the target zone.";
         // Add a delay or wait for players to confirm understanding
         this.clock.setTimeout(() => {
            // Check if still in instructions phase before proceeding
            if (this.state.phase === PHASES.INSTRUCTIONS) {
                 this.startRound();
            }
         }, 10000); // Show instructions for 10 seconds
     }

     startRound() {
        if (this.state.roundNumber >= this.maxRounds) {
            this.endExperiment();
            return;
        }
        if (this.state.phase === PHASES.ROUND_END || this.state.phase === PHASES.INSTRUCTIONS || this.state.phase === PHASES.LOBBY) {
             // Proceed only from valid previous states
        } else {
            console.warn(`Attempted to start round from invalid phase: ${this.state.phase}`);
            return;
        }


        this.state.roundNumber++;
        this.state.phase = PHASES.ROUND_STARTING; // Brief phase for setup
        console.log(`Starting Round ${this.state.roundNumber}`);

        // 1. Reset zones internal tracking
        for (const zoneKey in this.playersInZones) {
            this.playersInZones[zoneKey].clear();
        }

        // 2. Determine target zone
        const zoneKeys = Array.from(this.state.zones.keys());
        this.state.targetZone = zoneKeys[(this.state.roundNumber - 1) % zoneKeys.length];
        console.log(`Target Zone for Round ${this.state.roundNumber}: ${this.state.targetZone}`);

        // 3. Assign Roles
        this.assignRoles();

        // 4. Move all players to center & update state
        this.state.players.forEach((player, sessionId) => {
            player.x = ARENA_CENTER.x;
            player.y = ARENA_CENTER.y;
            player.targetX = null;
            player.targetY = null;
            player.currentEmote = null; // Clear emote from previous round
             // No need to send individual messages - state sync handles it
        });

        // 5. Start Round Timer & set phase to active
         this.clock.clear(); // Clear previous timers if any
         this.state.roundEndTime = this.clock.currentTime + this.roundDuration;
         this.state.phase = PHASES.ROUND_ACTIVE;

         this.roundTimer = this.clock.setTimeout(() => {
             this.endRound();
         }, this.roundDuration);


        // 6. Start Data Logging Interval
        if (this.logTimer) this.logTimer.clear(); // Use clock interval
        this.logTimer = this.clock.setInterval(() => {
            this.logRoundData();
            this.updateAllZoneOccupancy(); // Check positions periodically
        }, this.logInterval);

        console.log(`Round ${this.state.roundNumber} active. Ends at ${new Date(this.state.roundEndTime).toLocaleTimeString()}`);
    }

    assignRoles() {
        const playerIds = Array.from(this.state.players.keys());
        if (playerIds.length === 0) return;

        let informedCount = 0;
        if (this.state.roundNumber >= 1 && this.state.roundNumber <= 3) {
            informedCount = Math.min(1, playerIds.length);
        } else if (this.state.roundNumber >= 4 && this.state.roundNumber <= 6) {
            informedCount = Math.max(1, Math.floor(playerIds.length * 0.2));
        } else if (this.state.roundNumber >= 7 && this.state.roundNumber <= 9) {
             informedCount = Math.max(1, Math.floor(playerIds.length * 0.5));
        }

        const shuffledIds = playerIds.sort(() => 0.5 - Math.random());

        shuffledIds.forEach((id, index) => {
             const player = this.state.players.get(id);
             if (player) {
                 if (index < informedCount) {
                     player.role = 'informed';
                 } else {
                     player.role = 'uninformed';
                 }
             }
        });
        console.log(`Assigned roles for round ${this.state.roundNumber}: ${informedCount} informed players.`);
    }

    endRound() {
        if (this.state.phase !== PHASES.ROUND_ACTIVE) return;

        console.log(`Ending Round ${this.state.roundNumber}`);
        this.state.phase = PHASES.ROUND_END;
         if (this.roundTimer) this.roundTimer.clear();
         if (this.logTimer) this.logTimer.clear();
         this.roundTimer = null;
         this.logTimer = null;

        // Calculate score
        this.updateAllZoneOccupancy(); // Final check
        const playersInTargetZoneSet = this.playersInZones[this.state.targetZone] || new Set();
        const roundScore = playersInTargetZoneSet.size;
        this.state.score += roundScore; // Update cumulative score in state

        console.log(`Round ${this.state.roundNumber} Score: ${roundScore} (Players in ${this.state.targetZone}: ${playersInTargetZoneSet.size})`);
        this.logRoundData(true); // Log final state

        // Set lobby message for next stage
        this.state.lobbyMessage = `Round ${this.state.roundNumber} ended. Score: ${roundScore}. Total: ${this.state.score}. Target: ${this.state.targetZone}.`;

         // Broadcast round end info (could also put this in state if needed constantly)
         this.broadcast("roundEndInfo", {
             round: this.state.roundNumber,
             roundScore: roundScore,
             totalScore: this.state.score,
             targetZone: this.state.targetZone,
             playersInTargetZone: Array.from(playersInTargetZoneSet)
         });


        // Prepare for next round or end experiment
        if (this.state.roundNumber < this.maxRounds) {
            this.clock.setTimeout(() => {
                 // Check if still in round_end phase
                 if (this.state.phase === PHASES.ROUND_END) {
                      // Could go back to lobby briefly or straight to next round
                      // this.state.phase = PHASES.LOBBY; // Option 1: Back to lobby
                       this.startRound(); // Option 2: Start next round directly
                 }
            }, 5000); // 5 second delay
        } else {
             this.clock.setTimeout(() => {
                  if (this.state.phase === PHASES.ROUND_END) {
                      this.endExperiment();
                  }
             }, 5000);
        }
    }

     endExperiment() {
        console.log("Ending Experiment");
        this.state.phase = PHASES.EXPERIMENT_END;
         if (this.roundTimer) this.roundTimer.clear();
         if (this.logTimer) this.logTimer.clear();

        const finalData = {
            finalScore: this.state.score,
            totalRounds: this.state.roundNumber,
            message: "Experiment Complete. Thank you for participating.",
            debrief: "This was an experiment on collective decision-making..." // Full debrief text
        };

         this.state.lobbyMessage = `Experiment Finished! Final Score: ${this.state.score}`;
         // Broadcast final info (or put in state)
         this.broadcast('experimentEndInfo', finalData);

        this.dataLogger.finalizeLog();

         // Disconnect clients after a delay
         this.clock.setTimeout(() => {
             console.log("Disconnecting all clients.")
             this.disconnect(); // Disconnect all clients from the room
         }, 15000);
     }


     // --- Player Actions ---

     handlePlayerMovement(client, targetPosition) {
        const player = this.state.players.get(client.sessionId);
        // Only allow movement during active round
        if (player && this.state.phase === PHASES.ROUND_ACTIVE) {
            // Basic validation could happen here
            player.targetX = targetPosition.x;
            player.targetY = targetPosition.y;
            // State sync will inform clients. Client handles visual tweening.
             // Server needs to update player.x, player.y based on its own simulation or trust client position reports for logging/zone checks
             // For simplicity now, we log the target, but ideally server validates/simulates.
              // Let's assume client sends periodic 'positionUpdate' messages
        }
    }

     // Add handler for position updates from client if needed for accuracy
     // this.onMessage("positionUpdate", (client, position) => { ... });


    handlePlayerEmote(client, emoteKey) {
        const player = this.state.players.get(client.sessionId);
        // Allow emotes in lobby or active round
        if (player && (this.state.phase === PHASES.ROUND_ACTIVE || this.state.phase === PHASES.LOBBY || this.state.phase === PHASES.INSTRUCTIONS)) {
            const emoteMap = { '1': '!', '2': '+', '3': 'x', '4': '?' };
            const emote = emoteMap[emoteKey];
            if (emote) {
                player.currentEmote = emote;
                const timestamp = this.clock.currentTime;

                 // Broadcast emote event to clients for immediate display + timeout handling
                 this.broadcast("playerEmoted", { id: client.sessionId, emote: emote }, { except: client }); // Inform others
                  // Client handles its own immediate display

                 // Log the emote event immediately
                 this.dataLogger.log({
                     timestamp: timestamp,
                     round: this.state.roundNumber,
                     playerId: client.sessionId,
                     role: player.role,
                     x: player.x, // Log current position
                     y: player.y,
                     emoteAction: emote,
                     eventType: 'emote'
                 });

                 // Set a timer to clear the emote *in the state* after 2 seconds
                 this.clock.setTimeout(() => {
                     // Check if the player still exists and if the emote is still the same one we set
                      const currentPlayerState = this.state.players.get(client.sessionId);
                      if (currentPlayerState && currentPlayerState.currentEmote === emote) {
                          currentPlayerState.currentEmote = null;
                      }
                 }, 2000);
            }
        }
    }

     // --- Data Logging & Zone Checks ---

     logRoundData(isFinalLog = false) {
        if (!this.dataLogger || (this.state.phase !== PHASES.ROUND_ACTIVE && !isFinalLog)) return;

        const timestamp = this.clock.currentTime; // Use Colyseus clock time
        this.state.players.forEach((player, sessionId) => {
             // Update player position from client message or server simulation here before logging
             // For now, just log state position:
             // IMPORTANT: We need a mechanism to update player.x, player.y here based on client movement/updates
             // Placeholder: assume player.x/y in state is accurate enough for logging interval
             const currentZone = this.getPlayerCurrentZone(player);

             const data = {
                timestamp: timestamp,
                round: this.state.roundNumber,
                playerId: sessionId,
                role: player.role,
                x: player.x,
                y: player.y,
                emote: player.currentEmote,
                targetX: player.targetX,
                targetY: player.targetY,
                isInTargetZone: currentZone === this.state.targetZone,
                currentZone: currentZone,
                isFinalState: isFinalLog
            };
            this.dataLogger.log(data);
        });
    }

    updateAllZoneOccupancy() {
         // Clear previous occupancy
         for (const zoneKey in this.playersInZones) {
             this.playersInZones[zoneKey].clear();
         }
         // Check each player against each zone
         this.state.players.forEach((player, sessionId) => {
             const currentZone = this.checkPlayerZone(player);
             if (currentZone) {
                 this.playersInZones[currentZone].add(sessionId);
             }
         });
         // console.log("Zone Occupancy Updated:", this.playersInZones); // Debug logging
    }

     checkPlayerZone(player) {
         // IMPORTANT: Requires accurate player.x, player.y in the state.
         // Client needs to send position updates frequently, or server needs to simulate.
         for (const zoneKey in ZONE_DEFINITIONS) {
             const zone = ZONE_DEFINITIONS[zoneKey];
             const dx = player.x - zone.x;
             const dy = player.y - zone.y;
             const distanceSq = dx * dx + dy * dy;
             const radiiSq = zone.radius * zone.radius; // Simple check using zone radius only

             if (distanceSq <= radiiSq) {
                 return zoneKey; // Return the key/ID of the zone
             }
         }
         return null; // Not in any zone
     }

     getPlayerCurrentZone(player){
         // Wrapper for checkPlayerZone for convenience in logging
         return this.checkPlayerZone(player);
     }


    // --- Player Connection / Disconnection ---

    onJoin(client, options) {
        console.log(client.sessionId, "joined!");
        // Assign admin role to first player (simple approach)
        if (this.clients.length === 1) {
             this.adminSessionId = client.sessionId;
             console.log(`Player ${client.sessionId} assigned as admin.`);
              // Send a message to the client to let them know they are admin
              client.send("isAdmin", true);
        } else {
             client.send("isAdmin", false);
        }


        const { color, emoteColor } = getRandomColor();
        const player = new PlayerState({
             x: ARENA_CENTER.x, // Start everyone at center initially
             y: ARENA_CENTER.y,
             color: color,
             emoteColor: emoteColor,
             ready: false // Start as not ready
        });
        this.state.players.set(client.sessionId, player);
         this.state.lobbyMessage = `${this.state.players.size} player(s) connected. Waiting...`; // Update lobby message

         // If game is already in progress, new players join spectator mode or wait?
         // Current setup adds them directly, potentially mid-round. Adjust if needed.
          if (this.state.phase !== PHASES.LOBBY && this.state.phase !== PHASES.INSTRUCTIONS) {
             // Assign role immediately if joining mid-game (might need adjustment)
              const roles = ['informed', 'uninformed'];
              player.role = roles[Math.floor(Math.random()*roles.length)]; // Random role if joining late?
              console.log(`Player ${client.sessionId} joined mid-game, assigned role: ${player.role}`);
              // Send current round info
              client.send("lateJoinInfo", {
                  phase: this.state.phase,
                  round: this.state.roundNumber,
                  endTime: this.state.roundEndTime,
                  targetZone: this.state.targetZone, // Send target zone directly? Or rely on role update?
                  score: this.state.score,
                  role: player.role // Explicitly send assigned role
              });
          }

    }

    onLeave(client, consented) {
        console.log(client.sessionId, "left!");
        const player = this.state.players.get(client.sessionId);
        if (player) {
            this.state.players.delete(client.sessionId);
            // Remove from internal zone tracking
            for (const zoneKey in this.playersInZones) {
                this.playersInZones[zoneKey].delete(client.sessionId);
            }
             this.state.lobbyMessage = `${this.state.players.size} player(s) connected. Waiting...`;
             // Check if the admin left
             if(client.sessionId === this.adminSessionId) {
                 console.log("Admin left. Assigning new admin...");
                 this.adminSessionId = null;
                 if (this.clients.length > 0) {
                     this.adminSessionId = this.clients[0].sessionId; // Assign to next player in list
                     this.clients[0].send("isAdmin", true); // Inform the new admin
                      console.log(`New admin assigned: ${this.adminSessionId}`);
                 }
             }
        }
         // If last player leaves during active game, end it?
         if (this.state.players.size === 0 && this.state.phase !== PHASES.LOBBY && this.state.phase !== PHASES.EXPERIMENT_END) {
              console.log("Last player left. Ending experiment early.");
              this.endExperiment();
         }
    }

    onDispose() {
        console.log("Room", this.roomId, "disposing...");
        this.dataLogger.finalizeLog(); // Ensure logs are saved
         // Clear any remaining timers explicitly
         if (this.roundTimer) this.roundTimer.clear();
         if (this.logTimer) this.logTimer.clear();
    }
}

module.exports = ExperimentRoom;