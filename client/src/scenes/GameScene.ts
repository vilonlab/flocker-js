import Phaser, { NONE } from 'phaser';
import * as Colyseus from 'colyseus.js';
import { Player, Zone, RoomState, Phase } from '../../../server/src/rooms/schema/experimentSchema';
import { BACKEND_HTTP_URL, BACKEND_URL } from "../backend";
import { config } from '../config';
import {darkenColor, lightenColor} from '../utils';
import { TextureManager } from '../TextureManager';

export default class GameScene extends Phaser.Scene {
    private playerSpeed = config.player.speed;
    private lastPosition = { x: 0, y: 0 };
    private lastSentPosition = { x: 0, y: 0 };
    private lastPositionUpdateTime = 0;
    private lastCollisionPositionUpdateTime = 0; // Separate timer for collision updates
    private positionUpdateThreshold = config.network.positionUpdateThreshold;
    private positionUpdateInterval = config.network.positionUpdateInterval;
    private collisionUpdateInterval = config.network.collisionUpdateInterval;
    private textureManager: TextureManager;
    
    // Colyseus properties
    room: Colyseus.Room<RoomState>;
    playerEntities: { [sessionId: string]: Phaser.GameObjects.Container } = {};
	zoneEntities: { [zoneId: string]: Phaser.GameObjects.Container } = {};
    cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
    keys: { [key: string]: Phaser.Input.Keyboard.Key };
    playersGroup: Phaser.Physics.Arcade.Group;
    debugText: Phaser.GameObjects.Text;
    timerText: Phaser.GameObjects.Text;
    roundText: Phaser.GameObjects.Text;
    nameText: Phaser.GameObjects.Text;
    uiContainer: Phaser.GameObjects.Container;
    readyButton: Phaser.GameObjects.Text;
    readyText: Phaser.GameObjects.Text;
    countdownText: Phaser.GameObjects.Text;
    scoreText: Phaser.GameObjects.Text;
    scoreboardContainer: Phaser.GameObjects.Container;
    timerContainer: Phaser.GameObjects.Container;
    instructionContainer: Phaser.GameObjects.Container;

    constructor() {
        super({ key: "experiment" })
        this.textureManager = new TextureManager(this);
    }

    preload() {
        this.textureManager.preload();
    }

    async create(data?: { room?: Colyseus.Room<RoomState> }) {
        this.cursorKeys = this.input.keyboard!.createCursorKeys();

        // Create keys object that can recognize number keys 1-4
        this.keys = this.input.keyboard!.addKeys({
            'ONE': Phaser.Input.Keyboard.KeyCodes.ONE,
            'TWO': Phaser.Input.Keyboard.KeyCodes.TWO,
            'THREE': Phaser.Input.Keyboard.KeyCodes.THREE,
            'FOUR': Phaser.Input.Keyboard.KeyCodes.FOUR,
        }) as { [key: string]: Phaser.Input.Keyboard.Key };

        // this.cameras.main.setBackgroundColor(0xFFFFFF);
        const bg = this.add.image(config.game.width/2, config.game.height/2, 'background');
        bg.setDisplaySize(config.game.width, config.game.height);
        bg.setDepth(-100);


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

        const $ = Colyseus.getStateCallbacks(this.room);

        // Handle new zones added after we join
        $(this.room.state).zones.onAdd((zone, zoneId) => {
            console.log("New zone added:", zoneId, zone);

            const colorNumber = parseInt(zone.color.replace('#', ''), 16);

            // Create zone background image (full transporter)
            const zoneBg = this.add.image(0, 0, 'zone');
            zoneBg.setDisplaySize(zone.radius * 2, zone.radius * 2);

            // Create zone center image (center detail) with color tint
            const zoneCenter = this.add.image(0, 0, 'zone-center');
            zoneCenter.setDisplaySize(zone.radius * 2, zone.radius * 2);

            // Set to dark by default (off state), will brighten when player is aware of target
            const darkColor = darkenColor(colorNumber, 0.4);
            zoneCenter.setTint(darkColor);

            // Create a container to group the images
            const container = this.add.container(zone.x, zone.y, [zoneBg, zoneCenter]);
            container.setDepth(-1);

            // Store reference to zone center and full color for later updates
            (container as any).zoneCenter = zoneCenter;
            (container as any).fullColor = colorNumber;
            (container as any).darkColor = darkColor;

            this.zoneEntities[zone.id] = container;
        });

        // Listen for targetZone changes to update zone brightness
        $(this.room.state).listen('targetZone', (value) => {
            this.updateZoneBrightness();
        });

        // Handle new players added after we join
        $(this.room.state).players.onAdd((player, sessionId) => {
            console.log("New player added:", sessionId, player);


            // Convert hex color string to number (e.g., "#FF0000" -> 0xFF0000)
            const colorNumber = parseInt(player.color.replace('#', ''), 16);

            // Add player sprite
            const playerBg = this.add.image(0, 0, 'player');
            playerBg.setDisplaySize(player.radius * 2, player.radius * 2);
            playerBg.setDepth(1);

            // Add player sprite color details
            const playerDetail = this.add.image(0, 0, 'player-color');
            playerDetail.setDisplaySize(player.radius * 2, player.radius * 2);
            playerDetail.setTint(colorNumber);
            playerDetail.setDepth(2);

            // Create an arc (circle) for the player
            // const circle = this.add.arc(0, 0, player.radius, 0, 360, false, colorNumber, 1);

            // Add a drop shadow to the player
            // circle.postFX?.addShadow(0, 0.5, 0.05, 1, 0x000000, 10, 0.5);

            // Create text to display the emote on the player's screen
            const text = this.add.text(0, 0, player.emote.toString(), {
                fontSize: config.ui.playerText.fontSize,
                color: config.ui.playerText.color,
                fontStyle: config.ui.playerText.fontStyle
            });
            text.setOrigin(0.5, 0.5); // Center the text on its position
            text.setDepth(3);

            // Offset the text to align with the screen on the sprite
            // Adjust these values to match your sprite's screen position
            text.setPosition(player.radius * 0.2, 0); // Example: move up 20% of radius

            // Create a container to group the circle and text
            const container = this.add.container(player.x, player.y,
                [playerBg, playerDetail, text]
            );

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

            // listening for server updates
            $(player).onChange(() => {

                container.x = player.x;
                container.y = player.y;

                // Update the emote text for all players
                const textElement = container.getAt(2) as Phaser.GameObjects.Text;
                textElement.setText(player.emote.toString());
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
        });

        // add debugging text
        if (config.ui.debug.show) {
            const debugText = this.add
                .text(config.ui.debug.position.x, config.ui.debug.position.y, "debug text here")
                .setStyle({ color: config.ui.debug.color, fontSize: config.ui.debug.fontSize })
            this.debugText = debugText
        }

        // Create UI container with name, round, and timer text
        const player = this.getCurrentPlayer();

        // Create timer UI
        this.timerText = this.add.text(0, 0, '00:00', {
            color: '#ff9100ff',
            font: "VT323",
            fontSize: '24px'
        });

        this.timerContainer = this.add.container(
            config.game.width - 100,
            0,
            [this.timerText]
        );

        this.timerText.setOrigin(0.5, 0);
        this.timerText.setPosition(0, 0);
        this.timerContainer.setDepth(100);

        // Create text elements with black color and stroke
        this.nameText = this.add.text(0, 0, player ? player.name : 'Player', {
            color: '#000000',
            fontSize: '26px',
            fontStyle: 'bold'
        }).setStroke('#ffffff', 3);

        this.scoreText = this.add.text(0, 25, '0 points', {
            color: '#000000',
            fontSize: '24px',
        }).setStroke('#ffffff', 3); 

        this.roundText = this.add.text(0, 50, 'Round: 1/--', {
            color: '#000000',
            fontSize: '24px'
        }).setStroke('#ffffff', 3);

        // Create container and add text elements
        this.uiContainer = this.add.container(
            config.game.width - 10,
            config.game.height - 10,
            [this.nameText, this.scoreText, this.roundText]
        );

        // Position container in bottom right
        this.uiContainer.setDepth(100);

        // Align text to the right by setting their origin
        this.nameText.setOrigin(1, 1);
        this.roundText.setOrigin(1, 1);
        this.scoreText.setOrigin(1, 1);

        // Adjust positions relative to container
        this.nameText.setPosition(0, -75);
        this.scoreText.setPosition(0, -50);
        this.roundText.setPosition(0, -25);

        $(this.room.state).listen('phase', (value) => {
            const currentPlayer = this.getCurrentPlayer();
            console.log(`Phase changed to `, Phase[value]);

            // Update round text
            this.roundText.text = `Round ${this.room.state.roundNumber + 1}/${this.room.state.totalRounds}`;

            // Update score text
            if (this.room.state.isCollectiveScoring) {
                this.scoreText.text = `${this.room.state.collectiveScore} points`;
            } else {
                this.scoreText.text = `${currentPlayer?.points} points`;
            }
            

            if (value === Phase.WAITING) {
                if (this.instructionContainer) {
                    this.instructionContainer.setVisible(false);
                }
                if (!this.readyButton) {
                    this.readyButton = this.add
                        .text(config.game.width / 2, 200, 'Ready', {
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
                        .text(config.game.width / 2, 100, `${Array.from(this.room.state.players.values()).filter(p => p.ready).length}/${this.room.state.players.size} ready`, {
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
            } else if (value === Phase.COUNTDOWN) {
                if (this.instructionContainer) {
                    this.instructionContainer.setVisible(false);
                }
                if (this.scoreboardContainer) {
                    this.scoreboardContainer.setVisible(false);
                }
                if (this.readyButton) {
                    this.readyButton.setVisible(false);
                }
                if (this.readyText) {
                    this.readyText.setVisible(false);
                }

                if (!this.countdownText) {
                    this.countdownText = this.add
                        .text(config.game.width / 2, 200, `Round starts in ${this.room.state.countdownTime}s`, {
                            fontSize: '32px',
                            color: '#000000ff',
                            backgroundColor: '#0717ff6e',
                            padding: { x: 20, y: 10 }
                        })
                        .setOrigin(0.5)
                        .setDepth(10)
                        .setVisible(true);
                } else {
                    this.countdownText.setVisible(true);
                }
            } else if (value === Phase.SCOREBOARD) {
                // Show scoreboard when phase becomes SCOREBOARD
                this.showScoreboard();
            } else if (value === Phase.END) {
                this.runScene('end', {room: this.room});
            } else if (value === Phase.INSTRUCTION) {
                this.showInstructions();
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
                if (this.countdownText) {
                    this.countdownText.setVisible(false);
                }
                if (this.instructionContainer) {
                    this.instructionContainer.setVisible(false);
                }
            }
        })

        const currentPlayer = this.getCurrentPlayer();
        if (currentPlayer && this.readyButton) {
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

        // update debug text
        if (currentPlayer && this.debugText) {
            this.debugText.text = this.generateDebugText({
                session_id: this.room.sessionId,
                zone_id: currentPlayer.zone,
                room_id: this.room.roomId,
                target_zone: this.room.state.targetZone,
                player_points: currentPlayer.points,
                phase: this.room.state.phase,
                aware: currentPlayer.aware,
                ready: currentPlayer.ready,
                distance: currentPlayer.distance,
                emoteCount: currentPlayer.emoteCount,
                name: currentPlayer.name,
            });
        }

        this.timerText.text = this.room.state.roundTime > 9 ? "00:" + this.room.state.roundTime : "00:0" + this.room.state.roundTime;

        if (this.countdownText) {
            this.countdownText.text = `Round starts in ${this.room.state.countdownTime}s`;
        }
    }

    private generateDebugText(params: {
        session_id?: string;
        zone_id?: number;
        room_id?: string;
        target_zone?: number;
        player_points?: number;
        aware?: boolean;
        phase?: number;
        ready?: boolean;
        distance?: number;
        emoteCount?: number;
        name?: string;
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
            'Aware': params.aware?.toString(),
            'Phase': phase_string?.toString(),
            'Player Ready': params.ready?.toString(),
            'Distance traveled': params.distance?.toString(),
            'Emote count': params.emoteCount?.toString(),
            'Name': params.name?.toString()
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

    private updateZoneBrightness() {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer) return;

        // Update all zones based on whether they're the target and player is aware
        Object.keys(this.zoneEntities).forEach((zoneId) => {
            const container = this.zoneEntities[zoneId];
            const zoneCenter = (container as any).zoneCenter as Phaser.GameObjects.Image;
            const fullColor = (container as any).fullColor;
            const darkColor = (container as any).darkColor;
            const effect = (container as any).effect;

            // Brighten (glow) if this is the target zone and player is aware
            if (zoneId === this.room.state.targetZone.toString() && currentPlayer.aware) {
                zoneCenter.setTint(fullColor);
                if (!effect) {
                    const newEffect = zoneCenter.postFX?.addGlow(lightenColor(fullColor), 4, 2, false);
                    (container as any).effect = newEffect;
                }
            } else {
                // Darken (off state) for all other zones
                zoneCenter.setTint(darkColor);
                if (effect) {
                    zoneCenter.postFX.remove(effect);
                    (container as any).effect = undefined;
                }
            }
        });
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
                textColor: player.textColor,
                roundPoints: player.roundPoints,
            }))
            .sort((a, b) => b.points - a.points);

        // Scoreboard dimensions and positioning
        const centerX = config.game.width / 2;
        const centerY = config.game.height / 2;
        const boardWidth = 500;

        let boardHeight = 0;
        if (config.ui.scoreboard.showPlayers) {
            boardHeight = this.room.state.isCollectiveScoring ? 110 + players.length * 50 : 60 + players.length * 50;
        }
        else {
            boardHeight = this.room.state.isCollectiveScoring ? 110 : 60 + players.length * 50;
        }

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
        const title = this.add.text(centerX, startY + 30, `Round ${this.room.state.roundNumber + 1}`, {
            fontSize: '32px',
            color: '#000000',
            fontStyle: 'bold'
        });
        title.setOrigin(0.5);
        this.scoreboardContainer.add(title);

        // Create player rows
        // Adjust starting position based on scoring mode
        const firstRowY = this.room.state.isCollectiveScoring ? startY + 110 : startY + 70;
        var scoreDelta = 0;
        players.forEach((player, index) => {
            scoreDelta += player.roundPoints;

            // to be edited later, add config variable enables showing individual player scores
            if (config.ui.scoreboard.showPlayers) {
                const rowY = firstRowY + index * 50;

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

                const pointsDisplay = this.room.state.isCollectiveScoring
                    ? (player.roundPoints === 0 ? '-' : `+${player.roundPoints}`)
                    : `${player.points} pts`;

                // Player points
                const pointsText = this.add.text(centerX + 210, rowY, pointsDisplay, {
                    fontSize: '24px',
                    color: '#000000',
                    fontStyle: 'bold'
                });
                pointsText.setOrigin(1, 0.5);
                this.scoreboardContainer.add(pointsText);
            } else {

            }
        });

        if (this.room.state.isCollectiveScoring) {
            const collectiveText = this.add.text(centerX, startY + 70,
                `Team Score:  + ${scoreDelta}`, {
                    fontSize: '24px',
                    color: '#000000',
                    fontStyle: 'bold',
                }
            );
            collectiveText.setOrigin(0.5);
            this.scoreboardContainer.add(collectiveText);
        }

        // Set depth to ensure scoreboard is on top
        this.scoreboardContainer.setDepth(1000);
        this.scoreboardContainer.setVisible(true);
    }

    private showInstructions() {
        const instructionBackground = this.add.image(0, 0, 'instruction')
        instructionBackground.setDepth(1000);

        const instructionText = this.add.text(0, 0, this.room.state.instructionText, {
            color: "#000000",
            fontFamily: 'VT323',
            fontSize: '30px',
            wordWrap: {width: instructionBackground.width - 40},
        });

        const headerText = this.add.text (0,0, "Round Instructions", {
            color: '#ffffff',
            fontFamily: 'VT323',
            fontSize: '30px',
        });

        this.instructionContainer = this.add.container(
            config.game.width / 2,
            config.game.height / 2,
            [instructionBackground, instructionText, headerText]
        );

        instructionText.setOrigin(0, 0);
        instructionText.setPosition(
            -instructionBackground.width / 2 + 20,
            -instructionBackground.height / 2 + 70
        );

        headerText.setOrigin(0, 0);
        headerText.setPosition(
            -instructionBackground.width / 2 + 20,
            -instructionBackground.height / 2 + 20
        );
    }

    runScene(key: string, data?: any) {
        this.scene.start(key, data);
        this.scene.stop("experiment");
    }

}
