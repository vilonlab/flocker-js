import Phaser from 'phaser';
import * as Colyseus from 'colyseus.js';
import { Player, Zone, RoomState } from '../../../server/src/rooms/schema/experimentSchema'

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
    startButton: Phaser.GameObjects.Text;
    isHost: boolean = false;
    // currentPlayer: Phaser.GameObjects.Container;

    constructor() {
        super({ key: "experiment" });
    }

    // preload() {
    // }

    async create() {
        this.cursorKeys = this.input.keyboard!.createCursorKeys();

        // Create keys object that can recognize number keys 1-4
        this.keys = this.input.keyboard!.addKeys({
            'ONE': Phaser.Input.Keyboard.KeyCodes.ONE,
            'TWO': Phaser.Input.Keyboard.KeyCodes.TWO,
            'THREE': Phaser.Input.Keyboard.KeyCodes.THREE,
            'FOUR': Phaser.Input.Keyboard.KeyCodes.FOUR,
        }) as { [key: string]: Phaser.Input.Keyboard.Key };

        // connect with the room
        await this.connect();

        // Create physics group for players
        this.playersGroup = this.physics.add.group();

        // Add collider to prevent players from overlapping
        this.physics.add.collider(this.playersGroup, this.playersGroup, () => {
            // Check if room exists before accessing it
            if (!this.room) return;

            const currentTime = this.time.now;
            const timeSinceLastCollisionUpdate = currentTime - this.lastCollisionPositionUpdateTime;

            // Only send position update if enough time has passed
            if (timeSinceLastCollisionUpdate >= this.collisionUpdateInterval) {
                const playerEntity = this.playerEntities[this.room.sessionId];
                if (playerEntity) {
                    this.room.send("position", { "x": playerEntity.x, "y": playerEntity.y });
                    this.lastCollisionPositionUpdateTime = currentTime;
                }
            }
        });

        const $ = Colyseus.getStateCallbacks(this.room);

        // Handle new zones added after we join
        $(this.room.state).zones.onAdd((zone, zoneId) => {
            console.log("New zone added:", zoneId, zone);
            // Convert hex color string to number (e.g., "#FF0000" -> 0xFF0000)
            const colorNumber = parseInt(zone.color.replace('#', ''), 16);

            // Create an arc (circle) for this zone
            const entity = this.add.arc(zone.x, zone.y, zone.radius, 0, 360, false, colorNumber, config.zones.opacity);
            entity.setDepth(-1);
            this.zoneEntities[zoneId] = entity;
        });

        // Handle new players added after we join
        $(this.room.state).players.onAdd((player, sessionId) => {
            console.log("New player added:", sessionId, player);

            // Convert hex color string to number (e.g., "#FF0000" -> 0xFF0000)
            const colorNumber = parseInt(player.color.replace('#', ''), 16);

            // Create an arc (circle) for the player
            const circle = this.add.arc(0, 0, player.radius, 0, 360, false, colorNumber, 1);

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

            this.playerEntities[sessionId] = container;

            // if (sessionId === this.room.sessionId) {
            //     this.currentPlayer = container;
            // }

            // Add to players group for collision detection
            this.playersGroup.add(container);

            // listening for server updates
            $(player).onChange(() => {

                container.x = player.x;
                container.y = player.y;

                // Update the emote text for all players
                const textElement = container.getAt(1) as Phaser.GameObjects.Text;
                textElement.setText(player.emote.toString());
            });
        });

        // remove local reference when entity is removed from the server
        $(this.room.state).players.onRemove((player, sessionId) => {
            console.log("Player removed:", sessionId);
            const entity = this.playerEntities[sessionId];
            if (entity) {
                this.playersGroup.remove(entity, true, true); // remove from group and destroy
                delete this.playerEntities[sessionId]
            }
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

        // // Add start button (initially hidden)
        // this.startButton = this.add
        //     .text(400, 300, 'START ROUND', {
        //         fontSize: '32px',
        //         color: '#00ff00',
        //         backgroundColor: '#000000',
        //         padding: { x: 20, y: 10 }
        //     })
        //     .setOrigin(0.5)
        //     .setInteractive({ useHandCursor: true })
        //     .setVisible(true)
        //     .on('pointerdown', () => {
        //         if (this.isHost && !this.room.state.roundActive) {
        //             this.room.send('startRound');
        //         }
        //     })
        //     .on('pointerover', () => {
        //         if (this.isHost) {
        //             this.startButton.setStyle({ color: '#ffffff' });
        //         }
        //     })
        //     .on('pointerout', () => {
        //         this.startButton.setStyle({ color: '#00ff00' });
        //     });

        // // Listen for roundActive state changes
        // $(this.room.state).listen('roundActive', (value) => {
        //     console.log('Round active changed:', value);
        //     // Hide button when round is active
        //     if (this.isHost) {
        //         this.startButton.setVisible(!value);
        //     }
        // });

        // // Listen for changes to current player's host status
        // const currentPlayer = this.room.state.players.get(this.room.sessionId);
        // if (currentPlayer) {
        //     this.isHost = currentPlayer.host;
        //     this.startButton.setVisible(this.isHost && !this.room.state.roundActive);

        //     $(currentPlayer).listen('host', (value) => {
        //         console.log('Host status changed:', value);
        //         this.isHost = value;
        //         this.startButton.setVisible(this.isHost && !this.room.state.roundActive);
        //     });
        // }
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

        // only send movement if there's a delta and round is active
        if (dx !== 0 || dy !== 0) {
            this.room.send("move", { "x": dx, "y": dy });
        }

        // Check if selected emote is different from current character emote
        if (!this.room.state.players) {
            return;
        }
        const currentPlayer = this.room.state.players.get(this.room.sessionId);
        
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
                host: currentPlayer.host,
                game_status: this.room.state.roundActive,
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
        host?: boolean;
        game_status?: boolean;
    }) {
        const fields = {
            'Session ID': params.session_id,
            'Room ID': params.room_id,
            'Zone': params.zone_id?.toString(),
            'Target Zone': params.target_zone?.toString(),
            'Player Points': params.player_points?.toString(),
            'Game Status': params.game_status?.toString(),
            'Host': params.host?.toString(),
        };

        return Object.entries(fields)
            .map(([label, value]) => `\n${label}: ${value || ''}`)
            .join('');
    }

}
