import Phaser, { NONE } from 'phaser';
import * as Colyseus from 'colyseus.js';
import { Player, Zone, RoomState, Phase } from '../../../server/src/rooms/schema/experimentSchema'

import { BACKEND_HTTP_URL, BACKEND_URL } from "../backend";
import { config } from '../config';

export default class GameScene extends Phaser.Scene {
    private playerSpeed = config.player.speed;
    private lastPosition = { x: 0, y: 0 };
    private lastSentPosition = { x: 0, y: 0 };
    private lastPositionUpdateTime = 0;
    private lastCollisionPositionUpdateTime = 0; // Separate timer for collision updates
    private positionUpdateThreshold = config.network.positionUpdateThreshold;
    private positionUpdateInterval = config.network.positionUpdateInterval;
    private collisionUpdateInterval = config.network.collisionUpdateInterval;

    // Colyseus properties
    room: Colyseus.Room<RoomState>;
    playerEntities: { [sessionId: string]: Phaser.GameObjects.Container } = {};
	zoneEntities: { [zoneId: string]: Phaser.GameObjects.Arc } = {};
    cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
    keys: { [key: string]: Phaser.Input.Keyboard.Key };
    playersGroup: Phaser.Physics.Arcade.Group;
    debugText: Phaser.GameObjects.Text;
    timerText: Phaser.GameObjects.Text;
    readyButton: Phaser.GameObjects.Text;
    readyText: Phaser.GameObjects.Text;
    scoreboardContainer: Phaser.GameObjects.Container;

    constructor() {
        super({ key: "experiment" });
    }

    // preload() {
    // }

    async create(data?: { room?: Colyseus.Room<RoomState> }) {
        this.cursorKeys = this.input.keyboard!.createCursorKeys();

        // Create keys object that can recognize number keys 1-4
        this.keys = this.input.keyboard!.addKeys({
            'ONE': Phaser.Input.Keyboard.KeyCodes.ONE,
            'TWO': Phaser.Input.Keyboard.KeyCodes.TWO,
            'THREE': Phaser.Input.Keyboard.KeyCodes.THREE,
            'FOUR': Phaser.Input.Keyboard.KeyCodes.FOUR,
        }) as { [key: string]: Phaser.Input.Keyboard.Key };

        this.cameras.main.setBackgroundColor(0xFFFFFF);

        // Check if room was passed from MMScene, otherwise connect directly
        if (data?.room) {
            this.room = data.room;
            console.log("Using room from MMScene:", this.room.roomId);
        } else {
            // Fallback: connect directly (for testing or direct scene access)
            await this.connect();
        }

        // Listen for ready count updates from server
        this.room.onMessage("ready-count", (message) => {
            if (this.readyText) {
                this.readyText.setText(`${message.ready}/${message.total} ready`);
            }
        });

        // Create physics group for players
        this.playersGroup = this.physics.add.group({
            collideWorldBounds: true,
        });

        // // Add collider to prevent players from overlapping
        // this.physics.add.collider(this.playersGroup, this.playersGroup, () => {
        //     // Check if room exists before accessing it
        //     if (!this.room) return;

        //     const currentTime = this.time.now;
        //     const timeSinceLastCollisionUpdate = currentTime - this.lastCollisionPositionUpdateTime;

        //     // Only send position update if enough time has passed
        //     if (timeSinceLastCollisionUpdate >= this.collisionUpdateInterval) {
        //         const playerEntity = this.playerEntities[this.room.sessionId];
        //         if (playerEntity) {
        //             this.room.send("position", { "x": playerEntity.x, "y": playerEntity.y });
        //             this.lastCollisionPositionUpdateTime = currentTime;
        //         }
        //     }
        // });

        const $ = Colyseus.getStateCallbacks(this.room);

        // Handle new zones added after we join
        $(this.room.state).zones.onAdd((zone, zoneId) => {
            console.log("New zone added:", zoneId, zone);
            // Convert hex color string to number (e.g., "#FF0000" -> 0xFF0000)
            const colorNumber = parseInt(zone.color.replace('#', ''), 16);

            // Create an arc (circle) for this zone
            const entity = this.add.arc(zone.x, zone.y, zone.radius, 0, 360, false, colorNumber, config.zones.opacity);
            entity.setDepth(-1);
            if (this.room.state.targetZone === zone.id && this.room.state.players.get(this.room.sessionId)?.informed) {
                entity.setStrokeStyle(config.zones.targetWidth, config.zones.targetColor);
            }
            this.zoneEntities[zone.id] = entity;
        });

        // Listen for targetZone changes to update stroke
        $(this.room.state).listen('targetZone', (value) => {

            // Clear stroke from all zones
            Object.keys(this.zoneEntities).forEach((zoneId) => {
                if (zoneId === value.toString() && this.room.state.players.get(this.room.sessionId)?.informed) {
                    this.zoneEntities[zoneId].setStrokeStyle(config.zones.targetWidth, config.zones.targetColor);
                }
                else {
                    this.zoneEntities[zoneId].setStrokeStyle(0);
                }
            });
        });

        // Handle new players added after we join
        $(this.room.state).players.onAdd((player, sessionId) => {
            console.log("New player added:", sessionId, player);

            
            // Convert hex color string to number (e.g., "#FF0000" -> 0xFF0000)
            const colorNumber = parseInt(player.color.replace('#', ''), 16);

            // Create an arc (circle) for the player
            const circle = this.add.arc(0, 0, player.radius, 0, 360, false, colorNumber, 1);

            // Add a drop shadow to the player
            circle.postFX?.addShadow(0, 3, 0.05, 1, 0x000000, 10, 0.5);

            // Create text to display the emote in the middle of the circle
            const text = this.add.text(0, 0, player.emote.toString(), {
                fontSize: config.ui.playerText.fontSize,
                color: player.textColor,
                fontStyle: config.ui.playerText.fontStyle
            });
            text.setOrigin(0.5, 0.5); // Center the text

            // Create a container to group the circle and text
            const container = this.add.container(player.x, player.y, [circle, text]);

            // Enable physics on the container
            this.physics.world.enable(container);
            const body = container.body as Phaser.Physics.Arcade.Body;
            body.setCircle(player.radius);
            body.setCollideWorldBounds(true);


            this.playerEntities[sessionId] = container;

            // if (sessionId === this.room.sessionId) {
            //     this.currentPlayer = container;
            // }

            // Add to players group for collision detection
            this.playersGroup.add(container);

            // Update ready count when a player is added
            // this.updateReadyCount();

            // Listen for ready status changes
            // $(player).listen('ready', () => {
            //     this.updateReadyCount();
            // });

            // listening for server updates
            $(player).onChange(() => {

                container.x = player.x;
                container.y = player.y;

                // Update the emote text for all players
                const textElement = container.getAt(1) as Phaser.GameObjects.Text;
                textElement.setText(player.emote.toString());

                if (player === this.getCurrentPlayer()) {
                    Object.keys(this.zoneEntities).forEach((zoneId) => {
                        if (zoneId === this.room.state.targetZone.toString() && this.room.state.players.get(this.room.sessionId)?.informed) {
                            this.zoneEntities[zoneId].setStrokeStyle(config.zones.targetWidth, config.zones.targetColor);
                        }
                        else {
                            this.zoneEntities[zoneId].setStrokeStyle(0);
                        }
                    });
                }

            });
        });

        // remove local reference when entity is removed from the server
        $(this.room.state).players.onRemove((_player, sessionId) => {
            console.log("Player removed:", sessionId);
            const entity = this.playerEntities[sessionId];
            if (entity) {
                this.playersGroup.remove(entity, true, true); // remove from group and destroy
                delete this.playerEntities[sessionId]
            }
            // Update ready count when a player is removed
            // this.updateReadyCount();
        });

        // add debugging text
        const debugText = this.add
            .text(config.ui.debug.position.x, config.ui.debug.position.y, "debug text here")
            .setStyle({ color: config.ui.debug.color, fontSize: config.ui.debug.fontSize })
        this.debugText = debugText

        // add round timer text
        const timerText = this.add
            .text(config.ui.timer.position.x, config.ui.timer.position.y, config.ui.timer.prefix)
            .setStyle({ color: config.ui.timer.color, fontSize: config.ui.timer.fontSize })
        this.timerText = timerText

        $(this.room.state).listen('phase', (value) => {
            const currentPlayer = this.getCurrentPlayer();

            if (value === Phase.WAITING) {
                if (!this.readyButton) {
                    this.readyButton = this.add
                        .text(200, 100, 'Ready', {
                            fontSize: '32px',
                            color: '#000000ff',
                            backgroundColor: '#0717ff6e',
                            padding: { x: 20, y: 10 }
                        })
                        .setOrigin(0.5)
                        .setInteractive({ useHandCursor: true })
                        .on('pointerdown', () => {
                            const currentPlayer = this.getCurrentPlayer();
                            if (currentPlayer && !currentPlayer.ready) {
                                this.room.send('ready');
                                this.readyButton.setText("Ready ✓");
                                this.readyButton.setStyle({ backgroundColor: '#00ff006e'});
                            }
                        })
                        .setDepth(10)
                        .setVisible(true);
                } else {
                    this.readyButton.setVisible(true);
                }

                if (!this.readyText) {
                    this.readyText = this.add
                        .text(400, 100, `${Array.from(this.room.state.players.values()).filter(p => p.ready).length}/${this.room.state.players.size} ready`, {
                            fontSize: '32px',
                            color: '#000000ff',
                            backgroundColor: '#0717ff6e',
                            padding: { x: 20, y: 10 }
                        })
                        .setOrigin(0.5)
                        .setDepth(10)
                        .setVisible(true);
                } else {
                    this.readyText.setVisible(true);
                }

                // Update ready count display
                const readyCount = Array.from(this.room.state.players.values()).filter(p => p.ready).length;
                const totalCount = this.room.state.players.size;
                this.readyText.setText(`${readyCount}/${totalCount} ready`);

                if (currentPlayer && !currentPlayer.ready) {
                    this.readyButton.setText('Ready');
                    this.readyButton.setStyle({backgroundColor: '#0717ff6e'});
                }
                // Hide scoreboard when transitioning to WAITING
                if (this.scoreboardContainer) {
                    this.scoreboardContainer.setVisible(false);
                }
            } else if (value === Phase.SCOREBOARD) {
                // Show scoreboard when phase becomes SCOREBOARD
                this.showScoreboard();
            } else {
                // Hide scoreboard for other phases
                if (this.scoreboardContainer) {
                    this.scoreboardContainer.setVisible(false);
                }
                if (this.readyText) {
                    this.readyText.setVisible(false);
                }
                if (this.readyButton) {
                    this.readyButton.setVisible(false);
                }
            }
        })

        const currentPlayer = this.getCurrentPlayer();
        if (currentPlayer) {
            $(currentPlayer).listen('ready', (value) => {
                if (value) {
                    this.readyButton.setText("Ready ✓");
                    this.readyButton.setStyle({backgroundColor: '#00ff006e'});
                    this.readyButton.disableInteractive();
                } else {
                    this.readyButton.setText('Ready');
                    this.readyButton.setStyle({backgroundColor: '#0717ff6e'});
                    this.readyButton.setInteractive({useHandCursor: true});
                }

            });
        }
    }

    async connect() {

        const client = new Colyseus.Client(BACKEND_URL);

        try {

            this.room = await client.joinOrCreate("ExperimentRoom", {})

        } catch (e) {

            console.error("Connection error:", e);
        }

    }

    update(time: number, delta: number): void {
        // skip loop if not connected with room yet.
        if (!this.room) {
            return;
        }

        // calculate movement delta based on arrow keys
        let dx = 0;
        let dy = 0;
        let emote = "";

        if (this.cursorKeys.left.isDown) {
            dx -= 1;
        }
        if (this.cursorKeys.right.isDown) {
            dx += 1;
        }
        if (this.cursorKeys.up.isDown) {
            dy -= 1;
        }
        if (this.cursorKeys.down.isDown) {
            dy += 1;
        }
        if (this.keys.ONE.isDown) {
            emote = config.emotes.ONE;
        }
        if (this.keys.TWO.isDown) {
            emote = config.emotes.TWO;
        }
        if (this.keys.THREE.isDown) {
            emote = config.emotes.THREE;
        }
        if (this.keys.FOUR.isDown) {
            emote = config.emotes.FOUR;
        }

        // only send movement if there's a delta
        const currentPlayer = this.getCurrentPlayer();
        const playerEntity = this.playerEntities[this.room.sessionId]
        
        if (playerEntity) {
            const body = playerEntity.body as Phaser.Physics.Arcade.Body;
            if(body?.blocked.down && dy > 0) {
                dy = 0;
            }
            if(body?.blocked.up && dy < 0) {
                dy = 0;
            }
            if (body?.blocked.left && dx < 0) {
                dx = 0;
            }
            if (body?.blocked.right && dx > 0) {
                dx = 0;
            }
        }

        if (dx !== 0 || dy !== 0) {
            console.log("Sending move message: x: ", dx * this.playerSpeed, ", y: ", dy * this.playerSpeed);
            this.room.send("move", { "x": dx * this.playerSpeed, "y": dy * this.playerSpeed });
        }

        // Check if selected emote is different from current character emote
        if (!this.room.state.players) {
            return;
        }
        
        if (emote !== "" && currentPlayer && emote !== currentPlayer.emote) {
            this.room.send("emote", { "emote": emote });
        }

        // Sync position with server if it differs (for collision-based movements)
        // if (currentPlayer) {
        //     const playerEntity = this.playerEntities[this.room.sessionId];

        //     if (playerEntity) {
        //         const actualX = Math.round(playerEntity.x);
        //         const actualY = Math.round(playerEntity.y);
        //         const serverX = Math.round(currentPlayer.x);
        //         const serverY = Math.round(currentPlayer.y);

        //         // Calculate distance between actual position and server position
        //         const dx = Math.abs(actualX - serverX);
        //         const dy = Math.abs(actualY - serverY);

        //         if (dy > this.positionUpdateThreshold || dx > this.positionUpdateThreshold) {
        //             this.room.send("position", { "x": actualX, "y": actualY });
        //             console.log('Sent position message: x =' + actualX + " y = " + actualY)
        //             this.lastSentPosition = { x: actualX, y: actualY };
        //             this.lastPositionUpdateTime = time;
        //         }
        //     }
        // }

        // update debug text
        if (currentPlayer) {
            this.debugText.text = this.generateDebugText({
                session_id: this.room.sessionId,
                zone_id: currentPlayer.zone,
                room_id: this.room.roomId,
                target_zone: this.room.state.targetZone,
                player_points: currentPlayer.points,
                phase: this.room.state.phase,
                informed: currentPlayer.informed,
                ready: currentPlayer.ready,
            });
        }

        this.timerText.text = "" + this.room.state.roundTime;

        //         // Check if enough time has passed since last update
        //         const timeSinceLastUpdate = time - this.lastPositionUpdateTime;

        //         // Send position update if:
        //         // 1. Position differs by more than threshold, AND
        //         // 2. Enough time has passed since last update, AND
        //         // 3. Position has actually changed since last sent position
        //         // if ((dx > this.positionUpdateThreshold || dy > this.positionUpdateThreshold) &&
        //         //     timeSinceLastUpdate >= this.positionUpdateInterval &&
        //         //     (actualX !== this.lastSentPosition.x || actualY !== this.lastSentPosition.y)) {
        //         if (timeSinceLastUpdate >= this.positionUpdateInterval) {

        //         }
        //     }
        // }
    }

    private generateDebugText(params: {
        session_id?: string;
        zone_id?: number;
        room_id?: string;
        target_zone?: number;
        player_points?: number;
        informed?: boolean;
        phase?: number;
        ready?: boolean;
    }) {
        var phase_string = "";
        if (params.phase !== undefined) {
            phase_string = Phase[params.phase];
        }
        const fields = {
            'Session ID': params.session_id,
            'Room ID': params.room_id,
            'Zone': params.zone_id?.toString(),
            'Target Zone': params.target_zone?.toString(),
            'Player Points': params.player_points?.toString(),
            'Informed': params.informed?.toString(),
            'Phase': phase_string?.toString(),
            'Player Ready': params.ready?.toString(),
        };

        return Object.entries(fields)
            .map(([label, value]) => `\n${label}: ${value || ''}`)
            .join('');
    }

    private getCurrentPlayer() {
        if (this.room.state.players) {
             return this.room.state.players.get(this.room.sessionId);
        }
        return null;
    }

    private showScoreboard() {
        // Clear existing scoreboard if it exists
        if (this.scoreboardContainer) {
            this.scoreboardContainer.removeAll(true);
        } else {
            this.scoreboardContainer = this.add.container(0, 0);
        }

        // Get all players and sort by points (descending)
        const players = Array.from(this.room.state.players.entries())
            .map(([sessionId, player]) => ({
                sessionId,
                name: player.name,
                points: player.points,
                color: player.color,
                textColor: player.textColor
            }))
            .sort((a, b) => b.points - a.points);

        // Scoreboard dimensions and positioning
        const centerX = config.game.width / 2;
        const centerY = config.game.height / 2;
        const boardWidth = 500;
        const boardHeight = 60 + players.length * 50;
        const startY = centerY - boardHeight / 2;

        // Add ready button if it doesn't already exist
        if (!this.readyButton) {
            this.readyButton = this.add
                .text(200, startY - 30, 'Ready', {
                    fontSize: '32px',
                    color: '#000000ff',
                    backgroundColor: '#0717ff6e',
                    padding: { x: 20, y: 10 }
                })
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true })
                .setVisible(false)
                .on('pointerdown', () => {
                    const currentPlayer = this.getCurrentPlayer();
                    if (currentPlayer && !currentPlayer.ready) {
                        this.room.send('ready');
                        this.readyButton.setText("Ready ✓");
                        this.readyButton.setStyle({ backgroundColor: '#00ff006e'});
                    }
                })
                .setDepth(10);
        }

        if (!this.readyText) {
            this.readyText = this.add
                .text(400, 300, `${Array.from(this.room.state.players.values()).filter(p => p.ready).length}/${this.room.state.players.size} ready`, {
                    fontSize: '32px',
                    color: '#000000ff',
                    backgroundColor: '#0717ff6e',
                    padding: { x: 20, y: 10 }
                })
                .setOrigin(0.5)
                .setVisible(false)
                .setDepth(10);
        }

        // Create background
        const background = this.add.rectangle(
            centerX,
            centerY,
            boardWidth,
            boardHeight,
            0xffffff,
            0.95
        );
        background.setStrokeStyle(4, 0x000000);
        this.scoreboardContainer.add(background);

        // Create title
        const title = this.add.text(centerX, startY + 30, 'flocker', {
            fontSize: '32px',
            color: '#000000',
            fontStyle: 'bold'
        });
        title.setOrigin(0.5);
        this.scoreboardContainer.add(title);

        // Create player rows
        players.forEach((player, index) => {
            const rowY = startY + 70 + index * 50;

            // Player rank
            const rank = this.add.text(centerX - 160, rowY, `${index + 1}.`, {
                fontSize: '24px',
                color: '#000000'
            });
            rank.setOrigin(0, 0.5);
            this.scoreboardContainer.add(rank);

            // Player color indicator (small circle)
            const colorCircle = this.add.arc(
                centerX - 130,
                rowY,
                12,
                0,
                360,
                false,
                parseInt(player.color.replace('#', ''), 16),
                1
            );
            this.scoreboardContainer.add(colorCircle);

            // Player name
            const nameText = this.add.text(centerX - 100, rowY, player.name, {
                fontSize: '24px',
                color: '#000000'
            });
            nameText.setOrigin(0, 0.5);
            this.scoreboardContainer.add(nameText);

            // Player points
            const pointsText = this.add.text(centerX + 210, rowY, `${player.points} pts`, {
                fontSize: '24px',
                color: '#000000',
                fontStyle: 'bold'
            });
            pointsText.setOrigin(1, 0.5);
            this.scoreboardContainer.add(pointsText);
        });

        // Set depth to ensure scoreboard is on top
        this.scoreboardContainer.setDepth(10);
        this.scoreboardContainer.setVisible(true);

        this.readyButton.setVisible(true);
        this.readyText.setVisible(true);
    }

}
