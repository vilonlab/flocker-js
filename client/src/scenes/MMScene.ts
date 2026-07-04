import Phaser from "phaser";
import * as Colyseus from 'colyseus.js';
import { BACKEND_URL } from "../backend";
import { Player, Zone, RoomState, Phase } from '../../../server/src/rooms/schema/experimentSchema';
import { config } from '../config';


export default class MMScene extends Phaser.Scene {

    // Colyseus properties
    room: Colyseus.Room<RoomState>;
    client: Colyseus.Client;
    playerCountText: Phaser.GameObjects.Text;
    playerList: Phaser.GameObjects.Container;

    constructor() {
        super({ key: "mm" });
    }

    preload() {
        return;
    }

    async create() {
        // Set background color
        this.cameras.main.setBackgroundColor('#000000');

        // Connect to server
        await this.connect();

        // Wait for room state to be ready before accessing it
        await new Promise<void>((resolve) => {
            this.room.onStateChange.once((state) => {
                console.log("Room state initialized:", state);
                resolve();
            });
        });

        // Add text showing connected players
        this.playerCountText = this.add.text(
            config.game.width / 2,
            config.game.height / 5,
            `Players Connected: ${this.room.state.players.size}/${this.room.state.minClients}`,
            {
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '32px',
                fontStyle: 'bold',
                color: '#ffffff'
            }
        );
        this.playerCountText.setOrigin(0.5, 0.5) // Center the text on its position
            .setDepth(10); // Above all other background sprites

        // Add list of connected players
        this.playerList = this.add.container(0, 0);
        this.playerList.setDepth(11);
        this.playerList.setVisible(true);

        // Listen for player count changes
        const $ = Colyseus.getStateCallbacks(this.room);
        $(this.room.state).players.onAdd(() => {
            this.updatePlayerCount();
            this.updatePlayerList();
        });
        $(this.room.state).players.onRemove(() => {
            this.updatePlayerCount();
            this.updatePlayerList();
        });
    }

    async connect() {
        this.client = new Colyseus.Client(BACKEND_URL);

        try {
            this.room = await this.client.joinOrCreate("ExperimentRoom", {});
            console.log("Connected to room:", this.room.roomId);
        } catch (e) {
            console.error("Connection error:", e);
        }
    }

    updatePlayerCount() {
        if (this.playerCountText && this.room) {
            this.playerCountText.setText(
                `Players Connected: ${this.room.state.players.size}/${this.room.state.minClients}`
            );
        }
    }

    updatePlayerList() {
        if (!this.playerList || !this.room) return;

        // Clear existing player list elements
        this.playerList.removeAll(true);

        // Get all players
        const players = Array.from(this.room.state.players.entries())
            .map(([sessionId, player]) => ({
                sessionId,
                name: player.name,
                color: player.color,
                textColor: player.textColor
            }))
        
        // Sort array so current player is on top
        players.sort((a, b) => {
            if (a.sessionId === this.room.sessionId) {
                return -1;
            } else if (b.sessionId === this.room.sessionId) {
                return 1;
            } else {
                return 0;
            }
        });

        // List dimensions and positioning
        const centerX = config.game.width / 2;
        const centerY = config.game.height / 2;
        const boardWidth = 400;
        const boardHeight = players.length * 50;
        const startY = centerY;
        const fixedTopY = 200;
        const backgroundCenterY = fixedTopY + (boardHeight / 2);

        // Create background
        const background = this.add.rectangle(
            centerX,
            backgroundCenterY,
            boardWidth,
            boardHeight,
            0x999999,
            0.95
        );
        // background.setStrokeStyle(4, 0x000000);
        this.playerList.add(background);

        // Create player rows
        players.forEach((player, index) => {

            const rowY = fixedTopY + (index * 50) + 25;

            // Add background to current player
            if (this.room.sessionId === player.sessionId) {
                const playerBackground = this.add.rectangle(
                    centerX,
                    rowY,
                    boardWidth,
                    50,
                    0xffffff,
                    0.95
                );
                playerBackground.setDepth(5);
                this.playerList.add(playerBackground);
            }

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
            colorCircle.setDepth(10);
            this.playerList.add(colorCircle);

            // Player name
            const nameText = this.add.text(centerX - 100, rowY, player.name, {
                fontSize: '24px',
                color: '#000000'
            });
            nameText.setOrigin(0, 0.5);
            nameText.setDepth(10);
            this.playerList.add(nameText);
        });
    }

    update(): void {
        if (!this.room || !this.room.state || !this.room.state.phase) return;
        // console.log('Current state: ', this.room.state);
        // console.log('Room phase: ', this.room.state.phase);

        if (this.room.state.phase === Phase.WAITING || this.room.state.phase === Phase.INSTRUCTION) {
            console.log('Current phase: ', this.room.state.phase, '; running experiment scene');
            this.runScene('experiment', { room: this.room });
        }
        if (this.room.state.phase === Phase.END) {
            // Pass the room object to EndScene
            console.log('Current phase: ', this.room.state.phase, '; running end scene');
            this.runScene('end', { room: this.room });
        }
        else {
            return;
        }
    }

    private getCurrentPlayer() {
        if (this.room.state.players) {
             return this.room.state.players.get(this.room.sessionId);
        }
        return null;
    }

    runScene(key: string, data?: any) {
        this.scene.start(key, data);
        this.scene.stop("mm");
    }
}