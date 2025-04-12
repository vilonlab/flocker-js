// Ensure Colyseus client is available (loaded via script tag)
const Colyseus = window.Colyseus;

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.playerSprites = {};
        this.zoneSprites = {};
        this.selfId = null;
        this.playerSpeed = 150;
        this.room = null; // Colyseus room instance
        this.client = null; // Colyseus client instance

        // UI Element references
         this.uiOverlay = null;
         this.lobbyInfoPanel = null;
         this.lobbyMessageDisplay = null;
         this.playerListDisplay = null;
         this.readyButton = null;
         this.instructionsPanel = null;
         this.instructionsTextDisplay = null;
         this.gameplayInfoPanel = null;
         this.gameStatusDisplay = null;
         this.roundDisplay = null;
         this.roleDisplay = null;
         this.targetInfoPanel = null;
         this.targetZoneText = null;
         this.timerDisplay = null;
         this.scoreDisplay = null;
         this.finalMessagePanel = null;
         this.adminControlsPanel = null;
         this.serverStateDisplay = null; // For admin

        this.emoteSprites = {};
        this.emoteTimers = {};

        this.isReady = false; // Track client's own ready state
         this.isAdmin = false; // Track if this client is the admin
    }

    preload() {
        // Preload scene should still handle assets
        console.log("GameScene: Preload/Create sequence starting...");
    }


    create() {
        console.log("GameScene: Create");
        this.physics.world.setBounds(0, 0, this.game.config.width, this.game.config.height);

        // Get UI Element References
         this.uiOverlay = document.getElementById('ui-overlay');
         this.lobbyInfoPanel = document.getElementById('lobby-info');
         this.lobbyMessageDisplay = document.getElementById('lobby-message');
         this.playerListDisplay = document.getElementById('player-list');
         this.readyButton = document.getElementById('readyButton');
         this.instructionsPanel = document.getElementById('instructions-panel');
         this.instructionsTextDisplay = document.getElementById('instructions-text');
         this.gameplayInfoPanel = document.getElementById('gameplay-info');
         this.gameStatusDisplay = document.getElementById('game-status');
         this.roundDisplay = document.getElementById('round-number');
         this.roleDisplay = document.getElementById('player-role');
         this.targetInfoPanel = document.getElementById('target-info');
         this.targetZoneText = document.getElementById('target-zone-text');
         this.timerDisplay = document.getElementById('timer');
         this.scoreDisplay = document.getElementById('score');
         this.finalMessagePanel = document.getElementById('final-message');
         this.adminControlsPanel = document.getElementById('admin-controls');
         this.serverStateDisplay = document.getElementById('serverStateDisplay'); // Admin

        // --- Connect to Colyseus ---
        this.connect();

        // --- Input Handling --- (Remains similar)
        this.input.on('pointerdown', (pointer) => {
            if (this.room && this.selfId && this.playerSprites[this.selfId] && this.room.state.phase === 'round_active') {
                const targetPos = { x: pointer.worldX, y: pointer.worldY };
                this.playerSprites[this.selfId].setData('targetPos', targetPos);
                // Send target to server via Colyseus message
                this.room.send('playerMovement', targetPos);
            }
        });

        this.input.keyboard.on('keydown-ONE', () => this.sendEmote('1'));
        this.input.keyboard.on('keydown-TWO', () => this.sendEmote('2'));
        this.input.keyboard.on('keydown-THREE', () => this.sendEmote('3'));
        this.input.keyboard.on('keydown-FOUR', () => this.sendEmote('4'));

        // Ready Button Logic
        this.readyButton.addEventListener('click', () => {
             if (this.room && this.room.state.phase === 'lobby') {
                 this.isReady = !this.isReady;
                 this.room.send('setReady', { isReady: this.isReady });
                 this.updateReadyButtonVisuals();
             }
        });

        // Admin Button Logic (if admin)
         const startGameBtn = document.getElementById('startGameBtn');
         if (startGameBtn) {
             startGameBtn.addEventListener('click', () => {
                 if (this.room && this.isAdmin) {
                     this.room.send('admin_startGame');
                 }
             });
         }

    } // End of create()

    updateReadyButtonVisuals() {
         if (this.isReady) {
             this.readyButton.textContent = "Ready!";
             this.readyButton.classList.remove("notready");
             this.readyButton.classList.add("ready");
         } else {
             this.readyButton.textContent = "Ready?";
             this.readyButton.classList.remove("ready");
             this.readyButton.classList.add("notready");
         }
     }

    async connect() {
        try {
            // Determine server endpoint (handle development vs. production)
            const protocol = window.location.protocol === "https:" ? "wss" : "ws";
            // Use relative path for same-host deployment, or specific host for dev/different host
            const endpoint = (process.env.NODE_ENV === 'production')
                ? `${protocol}://${window.location.host}` // Use same host as webpage on Railway
                : `${protocol}://localhost:3000`; // Local development default

            console.log(`Connecting to Colyseus at ${endpoint}`);
            this.client = new Colyseus.Client(endpoint);

            console.log("Attempting to join 'experiment_room'...");
            this.room = await this.client.joinOrCreate('experiment_room');
            this.selfId = this.room.sessionId;
            console.log("Successfully joined room!", this.room.name, "My Session ID:", this.selfId);
            this.uiOverlay.style.display = 'block'; // Show UI now we are connected

            this.registerRoomEvents();

        } catch (e) {
            console.error("Join Error:", e);
            this.lobbyMessageDisplay.textContent = `Failed to connect: ${e.message}`;
            // Implement retry logic or display error message permanently
        }
    }

    registerRoomEvents() {
        if (!this.room) return;

        // --- State Change Handling ---
        this.room.onStateChange((state) => {
            // console.log("State changed:", state); // Debug: Log full state
             if (!this.selfId) return; // Ensure we have ID before processing player data

            // Update UI based on phase
            this.updateUIPhase(state.phase, state);

            // Update Timer & Score Display (regardless of phase, if applicable)
             this.scoreDisplay.textContent = `Score: ${state.score}`;
             if (state.phase === 'round_active' && state.roundEndTime > 0) {
                 this.updateTimerDisplay(state.roundEndTime);
                 this.timerDisplay.style.display = 'block';
             } else {
                 this.timerDisplay.style.display = 'none';
             }

             // Update server status display (admin)
             if (this.serverStateDisplay) this.serverStateDisplay.textContent = state.phase;

              // Update player list in lobby
              if (state.phase === 'lobby') {
                  this.updatePlayerList(state.players);
              }

            // Initial Zone Drawing (only once)
            if (Object.keys(this.zoneSprites).length === 0 && state.zones.size > 0) {
                 state.zones.forEach(zoneData => {
                     this.drawZone(zoneData);
                 });
             }

            // --- Player Updates (Handled by specific listeners below for efficiency) ---
            // We don't need to iterate through all players on every state change here
            // unless a property outside the .onAdd/.onRemove/.onChange handlers changes.
        });

        // --- Player Add/Remove/Change Listeners ---
        this.room.state.players.onAdd((player, sessionId) => {
            console.log("Player added:", sessionId, player);
             // Ensure player sprite doesn't already exist (e.g., due to connection flicker)
             if (!this.playerSprites[sessionId]) {
                 this.addPlayerSprite(player, sessionId);
             } else {
                 // Update existing sprite if needed
                 this.updatePlayerSprite(this.playerSprites[sessionId], player);
             }
             // Update player list if in lobby phase
            if (this.room.state.phase === 'lobby') this.updatePlayerList(this.room.state.players);
        });

        this.room.state.players.onRemove((player, sessionId) => {
             console.log("Player removed:", sessionId);
             this.removePlayerSprite(sessionId);
              // Update player list if in lobby phase
             if (this.room.state.phase === 'lobby') this.updatePlayerList(this.room.state.players);
        });

        this.room.state.players.onChange((player, sessionId) => {
            // console.log("Player changed:", sessionId, player); // Can be noisy
            const sprite = this.playerSprites[sessionId];
            if (sprite) {
                this.updatePlayerSprite(sprite, player);
            }
            // Update player list visuals if in lobby (e.g., ready status changed)
             if (this.room.state.phase === 'lobby') this.updatePlayerList(this.room.state.players);
        });


        // --- Room Message Handling ---
        this.room.onMessage("isAdmin", (isAdmin) => {
             console.log(`Received isAdmin status: ${isAdmin}`);
             this.isAdmin = isAdmin;
             this.adminControlsPanel.style.display = isAdmin ? 'block' : 'none';
         });

        this.room.onMessage("error", (message) => {
             console.error("Server Error Message:", message);
             // Display error to user? (e.g., using an alert or UI element)
             alert(`Server Error: ${message}`);
         });

        this.room.onMessage("roundEndInfo", (data) => {
            console.log("Received Round End Info:", data);
             // Update UI with specific round end details
             this.gameStatusDisplay.textContent = `Round ${data.round} Ended`;
             // Highlight players etc. can be done here
              this.highlightPlayersInZone(data.playersInTargetZone); // Assuming function exists
        });

         this.room.onMessage("experimentEndInfo", (data) => {
            console.log("Received Experiment End Info:", data);
             // Display final message/debrief
             document.getElementById('final-title').textContent = data.message;
             document.getElementById('final-score-display').textContent = `Final Score: ${data.finalScore}`;
             document.getElementById('final-debrief').textContent = data.debrief;
             document.getElementById('final-thankyou').textContent = "Thank you for participating!";
             this.finalMessagePanel.style.display = 'block';
         });

         this.room.onMessage("playerEmoted", (data) => {
            // Show emote for OTHER players (self already displayed)
             if (data.id !== this.selfId) {
                 this.showEmote(data.id, data.emote);
             }
        });

        // Handle late join info
         this.room.onMessage("lateJoinInfo", (data) => {
             console.log("Joined mid-game. Info:", data);
             // Update UI immediately based on this data if needed, though onStateChange should also cover it.
              this.gameStatusDisplay.textContent = `Status: ${data.phase}`;
              this.roundDisplay.textContent = data.round;
              this.roleDisplay.textContent = data.role;
              this.scoreDisplay.textContent = `Score: ${data.score}`;
              if (data.role === 'informed' && data.targetZone) {
                 this.targetZoneText.textContent = data.targetZone;
                 this.targetInfoPanel.style.display = 'block';
              } else {
                  this.targetInfoPanel.style.display = 'none';
              }
         });


        // --- Error Handling ---
        this.room.onError((code, message) => {
            console.error("Colyseus room error:", code, message);
            // Handle potential errors (e.g., display message to user)
            this.lobbyMessageDisplay.textContent = `Room Error: ${message} (Code: ${code})`;
        });

        this.room.onLeave((code) => {
            console.log("Left room.", code);
             this.playerSprites = {}; // Clear sprites on leave
             this.zoneSprites = {};
             this.selfId = null;
             this.room = null;
             // Display appropriate message (disconnected, experiment over, etc.)
              this.uiOverlay.style.display = 'none'; // Hide main UI
              // Could show a specific "Disconnected" message panel
              if (code === 1000) { // Normal closure
                  // Handled by experimentEnd usually
              } else {
                  alert(`Disconnected from server (Code: ${code})`);
              }
        });
    }

     updateUIPhase(phase, state) {
         // Hide all panels by default
         this.lobbyInfoPanel.style.display = 'none';
         this.instructionsPanel.style.display = 'none';
         this.gameplayInfoPanel.style.display = 'none';
          this.finalMessagePanel.style.display = 'none'; // Ensure final message hidden unless experiment end
          this.scoreDisplay.style.display = 'none'; // Hide score unless active/end


         // Show relevant panel based on phase
         switch (phase) {
             case 'lobby':
                 this.lobbyInfoPanel.style.display = 'block';
                 this.lobbyMessageDisplay.textContent = state.lobbyMessage || "Waiting for players...";
                 this.updatePlayerList(state.players); // Ensure list is updated
                 break;
             case 'instructions':
                 this.instructionsPanel.style.display = 'block';
                 this.instructionsTextDisplay.textContent = state.instructionText;
                 break;
             case 'round_starting':
                 this.gameplayInfoPanel.style.display = 'block';
                 this.gameStatusDisplay.textContent = `Starting Round ${state.roundNumber}...`;
                 this.roundDisplay.textContent = state.roundNumber;
                 // Role/Target info updated via player state change
                 break;
             case 'round_active':
                 this.gameplayInfoPanel.style.display = 'block';
                 this.gameStatusDisplay.textContent = `Round ${state.roundNumber} Active`;
                 this.roundDisplay.textContent = state.roundNumber;
                 this.scoreDisplay.style.display = 'block';
                 // Update own role/target info if changed
                 this.updateSelfInfo(state.players.get(this.selfId), state.targetZone);
                 break;
             case 'round_end':
                 this.gameplayInfoPanel.style.display = 'block';
                 this.gameStatusDisplay.textContent = `Round ${state.roundNumber} Ended`;
                 this.roundDisplay.textContent = state.roundNumber;
                 this.scoreDisplay.style.display = 'block';
                 this.targetInfoPanel.style.display = 'none'; // Hide target zone info
                  // Stop player movement visually
                 for (const playerId in this.playerSprites) {
                     this.playerSprites[playerId].setData('targetPos', null);
                      if(this.playerSprites[playerId].body) { // Check body exists
                           this.playerSprites[playerId].body.velocity.reset();
                      }
                 }
                 break;
             case 'experiment_end':
                  // Handled by experimentEndInfo message typically
                  // If relying solely on state:
                 // this.finalMessagePanel.style.display = 'block';
                 // Update final message content here from state if needed
                 break;
             default:
                  this.lobbyMessageDisplay.textContent = `Unknown phase: ${phase}`;
                 this.lobbyInfoPanel.style.display = 'block';
         }
     }

    updateSelfInfo(playerState, targetZone) {
        if (playerState) {
             this.roleDisplay.textContent = playerState.role;
             if (playerState.role === 'informed' && targetZone) {
                 this.targetZoneText.textContent = targetZone;
                 this.targetInfoPanel.style.display = 'block';
             } else {
                 this.targetInfoPanel.style.display = 'none';
             }
        } else {
            // Own player state not found? Handle error/wait.
             this.roleDisplay.textContent = 'Unknown';
             this.targetInfoPanel.style.display = 'none';
        }
    }

     updatePlayerList(playersMap) {
        if (!this.playerListDisplay) return;
         this.playerListDisplay.innerHTML = ''; // Clear previous list
         playersMap.forEach((player, sessionId) => {
             const li = document.createElement('li');
             const readyStatus = player.ready ? '<span class="ready">(Ready)</span>' : '<span class="not-ready">(Not Ready)</span>';
             li.innerHTML = `${player.name || 'Player'} ${sessionId === this.selfId ? '(You)' : ''} ${readyStatus}`;
             this.playerListDisplay.appendChild(li);
         });
     }


    addPlayerSprite(playerData, sessionId) {
         // console.log(`Attempting to add sprite for ${sessionId}`);
         let playerSprite = this.physics.add.sprite(playerData.x, playerData.y, 'player');
         playerSprite.setCollideWorldBounds(true);
         playerSprite.setCircle(playerSprite.width / 2);
         playerSprite.setTint(playerData.color);
         playerSprite.setData('id', sessionId);
         playerSprite.setData('targetPos', null);
         playerSprite.setData('initialColor', playerData.color); // Store initial color
         this.playerSprites[sessionId] = playerSprite;

         let emoteSprite = this.add.sprite(playerData.x, playerData.y - 20, 'emotes');
         emoteSprite.setVisible(false);
         emoteSprite.setOrigin(0.5, 1);
         // emoteSprite.setTint(playerData.emoteColor); // Apply emote color?
         this.emoteSprites[sessionId] = emoteSprite;

          // Update emote state if initially provided
         if (playerData.currentEmote) {
             this.showEmote(sessionId, playerData.currentEmote);
         }
         console.log(`Added sprite for ${sessionId}`);
     }

    removePlayerSprite(sessionId) {
        if (this.playerSprites[sessionId]) {
            this.playerSprites[sessionId].destroy();
            delete this.playerSprites[sessionId];
        }
         if (this.emoteSprites[sessionId]) {
            this.emoteSprites[sessionId].destroy();
            delete this.emoteSprites[sessionId];
         }
         if (this.emoteTimers[sessionId]) {
            clearTimeout(this.emoteTimers[sessionId]);
            delete this.emoteTimers[sessionId];
         }
         console.log(`Removed sprite for ${sessionId}`);
    }

     updatePlayerSprite(sprite, playerData) {
        if (!sprite || !playerData) return;

        // Smooth movement for remote players? (or just teleport)
         if (sprite.getData('id') !== this.selfId) {
             // Option 1: Teleport
             // sprite.setPosition(playerData.x, playerData.y);
             // Option 2: Smooth tweening (more complex, needs target handling)
              this.physics.moveTo(sprite, playerData.x, playerData.y, this.playerSpeed * 0.5); // Move towards state pos slowly?

         }

         // Update other properties
        sprite.setTint(playerData.color);
         sprite.setData('initialColor', playerData.color); // Update stored color


        // Update emote state from server state
        if (playerData.currentEmote) {
             this.showEmote(sprite.getData('id'), playerData.currentEmote);
        } else {
            this.hideEmote(sprite.getData('id'));
        }

         // Update role/target info if it's the self player
         if (sprite.getData('id') === this.selfId) {
             this.updateSelfInfo(playerData, this.room.state.targetZone);
         }
    }

    updateTimerDisplay(endTime) {
        if (this.timerDisplay) {
             const remaining = Math.max(0, endTime - this.room.clock.currentTime); // Use Colyseus clock if available and synced
             // Fallback if clock isn't perfectly synced: use local time approximation based on initial end time
             // const remaining = Math.max(0, initialEndTimeFromServer - Date.now());
             const seconds = Math.floor((remaining / 1000) % 60);
             const minutes = Math.floor((remaining / (1000 * 60)) % 60);
             this.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    update(time, delta) {
        if (!this.selfId || !this.room || !this.playerSprites[this.selfId]) return;

         // --- Self Movement ---
         const selfSprite = this.playerSprites[this.selfId];
         if (selfSprite.getData('targetPos') && this.room.state.phase === 'round_active') {
             this.movePlayerTowards(selfSprite, selfSprite.getData('targetPos'), delta);
         } else if (selfSprite.body && selfSprite.body.velocity.x !== 0 || selfSprite.body.velocity.y !== 0) {
              selfSprite.body.velocity.reset(); // Ensure stopped if no target
         }

         // --- Other Player Movement (if using moveTo for smoothing) ---
         for (const sessionId in this.playerSprites) {
            if (sessionId !== this.selfId) {
                const sprite = this.playerSprites[sessionId];
                const playerState = this.room.state.players.get(sessionId);
                if (sprite && playerState && sprite.body) {
                    // Stop smoothing if close enough to the state position
                    const distance = Phaser.Math.Distance.Between(sprite.x, sprite.y, playerState.x, playerState.y);
                    if (distance < 4) {
                        sprite.body.reset(playerState.x, playerState.y); // Snap to final position
                    }
                }
            }
        }


         // --- Update Emote Positions ---
         this.updateEmotePositions();

         // --- Update Timer --- (Driven by state change now, but could update sub-second here)
         if (this.room.state.phase === 'round_active' && this.room.state.roundEndTime > 0) {
              this.updateTimerDisplay(this.room.state.roundEndTime);
         }

    } // End of update()

    // --- Helper Functions --- (drawZone, movePlayerTowards, sendEmote, show/hideEmote, highlightPlayers, resetHighlighting - adapt as needed)

     drawZone(zoneData) {
        if (!this.zoneSprites[zoneData.id]) {
            let zoneSprite = this.add.sprite(zoneData.x, zoneData.y, 'zone');
            zoneSprite.setAlpha(0.7);
            zoneSprite.setDisplaySize(zoneData.radius * 2, zoneData.radius * 2);
            this.add.text(zoneData.x, zoneData.y, zoneData.id, { fontSize: '16px', fill: '#000' }).setOrigin(0.5);
            this.zoneSprites[zoneData.id] = zoneSprite;
        }
    }

    movePlayerTowards(playerSprite, targetPos, delta) {
        const distance = Phaser.Math.Distance.Between(playerSprite.x, playerSprite.y, targetPos.x, targetPos.y);
        if (distance < 5) {
             if (playerSprite.body) playerSprite.body.velocity.reset();
             playerSprite.setData('targetPos', null);
             // Send final position update? Optional. Colyseus state might lag slightly.
             // this.room.send("positionUpdate", { x: playerSprite.x, y: playerSprite.y });
        } else if (playerSprite.body) {
             const angle = Phaser.Math.Angle.Between(playerSprite.x, playerSprite.y, targetPos.x, targetPos.y);
             this.physics.velocityFromRotation(angle, this.playerSpeed, playerSprite.body.velocity);

             // --- CRITICAL for Server Accuracy ---
             // Send frequent position updates while moving
             const lastSent = playerSprite.getData('lastSentPosTime') || 0;
             if (this.room.clock.currentTime - lastSent > 100) { // Send every 100ms
                  // console.log("Sending position update"); // DEBUG
                  // this.room.send("positionUpdate", { x: playerSprite.x, y: playerSprite.y }); // Need server handler
                  playerSprite.setData('lastSentPosTime', this.room.clock.currentTime);
                  // IMPORTANT: Server MUST use these updates to update player.x/y in its state for accurate logging/zone checks
             }

        }
    }

     sendEmote(emoteKey) {
        if (this.room && this.selfId && (this.room.state.phase === 'round_active' || this.room.state.phase === 'lobby' || this.room.state.phase === 'instructions')) {
            console.log(`Sending emote: ${emoteKey}`);
            this.room.send('playerEmote', emoteKey);
             // Show emote locally immediately for responsiveness
            const emoteMap = { '1': '!', '2': '+', '3': 'x', '4': '?' };
            this.showEmote(this.selfId, emoteMap[emoteKey]);
        }
    }

     showEmote(playerId, emoteSymbol) {
         // ... (Implementation similar to previous version, using this.emoteSprites, this.emoteTimers) ...
         const playerSprite = this.playerSprites[playerId];
         const emoteSprite = this.emoteSprites[playerId];
         if (!playerSprite || !emoteSprite || !emoteSymbol) return;

         if (this.emoteTimers[playerId]) clearTimeout(this.emoteTimers[playerId]);

         const emoteAnimKey = `emote_${emoteSymbol}`;
         if (this.anims.exists(emoteAnimKey)) {
             emoteSprite.play(emoteAnimKey);
             emoteSprite.setVisible(true);
             emoteSprite.setPosition(playerSprite.x, playerSprite.y - playerSprite.displayHeight / 2 - 10);

             // Client handles visual timeout, server clears state later
             this.emoteTimers[playerId] = setTimeout(() => {
                 this.hideEmote(playerId);
             }, 2000);
         }
     }

      hideEmote(playerId) {
          // ... (Implementation similar to previous version) ...
           const emoteSprite = this.emoteSprites[playerId];
           if (emoteSprite) emoteSprite.setVisible(false);
           if (this.emoteTimers[playerId]) {
               clearTimeout(this.emoteTimers[playerId]);
               delete this.emoteTimers[playerId];
           }
     }

     updateEmotePositions() {
        for (const playerId in this.emoteSprites) {
             const emoteSprite = this.emoteSprites[playerId];
             const playerSprite = this.playerSprites[playerId];
             if (emoteSprite && playerSprite && emoteSprite.visible) {
                 emoteSprite.setPosition(playerSprite.x, playerSprite.y - playerSprite.displayHeight / 2 - 10);
             }
         }
     }

     // highlightPlayersInZone and resetPlayerHighlighting would be similar to before


} // End of class GameScene