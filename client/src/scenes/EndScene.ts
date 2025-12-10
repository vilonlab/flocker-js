import Phaser from "phaser";
import * as Colyseus from 'colyseus.js';
import { BACKEND_HTTP_URL, BACKEND_URL } from "../backend";
import { Player, Zone, RoomState, Phase } from '../../../server/src/rooms/schema/experimentSchema';
import { config } from '../config';
import { getRandomColor } from '../helpers';


export default class EndScene extends Phaser.Scene {

    // Colyseus objects
    room: Colyseus.Room<RoomState>;

    scoreboardContainer: Phaser.GameObjects.Container;

    constructor() {
        super({ key: "end" });
    }

    preload() {
        return;
    }

    create(data?: { room?: Colyseus.Room<RoomState> }) {

        // Check if room was passed from GameScene, otherwise error
        if (data?.room) {
            this.room = data.room;
            console.log("Using room from GameScene:", this.room.roomId);
        } else {
            throw new Error('Cannot connect to room');
        }

        // Display the scoreboard
        this.showScoreboard();
    }

    update(): void {
        return;
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
                distance: player.distance,
                emoteCount: player.emoteCount,
            }))
            .sort((a, b) => b.points - a.points);

        // Scoreboard dimensions and positioning
        const centerX = config.game.width / 2;
        const centerY = config.game.height / 2;
        const boardWidth = 500;
        const boardHeight = 60 //+ players.length * 50;
        const startY = centerY - boardHeight / 2;

        // Create background
        const background = this.add.rectangle(
            centerX,
            centerY,
            boardWidth,
            boardHeight,
            0xffffff
        );
        background.setStrokeStyle(4, 0x000000);
        this.scoreboardContainer.add(background);

        // Create title
        const title = this.add.text(centerX, startY + 30, 'Game Over', {
            fontSize: '32px',
            color: '#000000',
            fontStyle: 'bold'
        });
        title.setOrigin(0.5);
        this.scoreboardContainer.add(title);

        // Create player rows
        var rowY = 0;
        var maxDist = {
            'name': '',
            'dist': 0,
        }
        var mostEmotes = {
            'name': '',
            'count': 0,
        }
        players.forEach((player, index) => {
            rowY = startY + 70 + index * 50;

            // Player rank
            const rank = this.add.text(centerX - 160, rowY, `${index + 1}.`, {
                fontSize: '24px',
                color: '#ffffff'
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
                color: '#ffffff'
            });
            nameText.setOrigin(0, 0.5);
            this.scoreboardContainer.add(nameText);

            // Player points
            const pointsText = this.add.text(centerX + 210, rowY, `${player.points} pts`, {
                fontSize: '24px',
                color: '#ffffff',
                fontStyle: 'bold'
            });
            pointsText.setOrigin(1, 0.5);
            this.scoreboardContainer.add(pointsText);

            // Update max data
            if (player.distance > maxDist.dist) {
                maxDist = {
                    'name': player.name,
                    'dist': player.distance,
                }
            }
            if (player.emoteCount > mostEmotes.count) {
                mostEmotes = {
                    'name': player.name,
                    'count': player.emoteCount,
                }
            }
            console.log(maxDist, mostEmotes);
        });

        // Create fun fact
        const factText = this.add.text(centerX + 210, rowY + 50, "", {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        factText.setOrigin(1, 0.5);
        this.scoreboardContainer.add(factText);

        if (Math.random() < 0.5 && maxDist.dist > 0) {
            factText.text = `${maxDist.name} moved the most this game, ${maxDist.dist} pixels`
        } else if (mostEmotes.count > 0) {
            factText.text = `${mostEmotes.name} emoted the most this game, ${mostEmotes.count} times`
        }

        // Set depth to ensure scoreboard is on top
        this.scoreboardContainer.setDepth(11);
        this.scoreboardContainer.setVisible(true);
    }

    runScene(key: string) {
        this.scene.start(key);
        this.scene.stop("end");
    }
}