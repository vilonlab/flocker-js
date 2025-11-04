import {Room, type Client} from 'colyseus';
import DataLogger from '../dataLogger';
import {Player, Zone, RoomState, Phase} from './schema/experimentSchema';
import {config} from '../config';
import { randomInt } from 'node:crypto';

export class ExperimentRoom extends Room<RoomState> {
	state = new RoomState();
	logger = DataLogger.getInstance();
    maxClients: number = config.game.maxClients;

	private zoneHues = new Set<number>(); // Track hues used by zones
	private playerHues = new Set<number>(); // Track hues used by players
	private timerStarted = false; // Track if round timer has started
	private roundDuration = config.round.duration; // Round duration in seconds
	private emoteTimeouts = new Map<string, any>(); // Track emote timeouts per player
    private informedCount = 0;
    private playerLock = true;

	onCreate(options: any) {
		console.log('ExperimentRoom created!', options);

        this.clock.start()

		// Create four zones around the center of the screen
		const centerX = config.world.centerX;
		const centerY = config.world.centerY;
		const zoneRadius = config.zones.radius;
		const offset = config.zones.offsetFromCenter; // Distance from center

		// Left zone
        // makeZone(id: number, x: number, y: number, radius: number):
        const leftZone = this.makeZone(0, centerX - offset, centerY, zoneRadius);
        this.state.zones.set('left', leftZone);

        const rightZone = this.makeZone(1, centerX + offset, centerY, zoneRadius);
        this.state.zones.set('right', rightZone);

        const topZone = this.makeZone(2, centerX, centerY + offset, zoneRadius);
        this.state.zones.set('top', topZone);

        const bottomZone = this.makeZone(3, centerX, centerY - offset, zoneRadius);
        this.state.zones.set('bottom', bottomZone);

		// Set up periodic snapshot logging
		this.clock.setInterval(() => {
			this.logger.logSnapshot({
				timestamp: this.clock.currentTime, // Colyseus simulation time
				serverTime: Date.now(), // Real-world timestamp
				roomId: this.roomId,
				roundNumber: undefined, // Add if you have round tracking
				phase: undefined, // Add if you have game phases
				targetZone: undefined, // Add if you have target zones
				players: [...this.state.players.values()].map(player => ({
					x: player.x,
					y: player.y,
					name: player.name,
					color: player.color,
                    textcolor: player.textColor,
                    emote: player.emote,
                    zone: player.zone,
                    points: player.points,
                    informed: player.informed,
                    ready: player.ready
				})),
			});
		}, config.logging.snapshotInterval);

        // Ready all players for debugging from Colyseus playground
        this.onMessage('ready-all', (client, data) => {
            this.state.players.forEach((player) => {
                player.ready = true;
            });
        });

		// Called every time this room receives a "move" message
		this.onMessage('move', (client, data) => {
			const player = this.state.players.get(client.sessionId);

			if (!player) {
				console.error(`Player not found for session ${client.sessionId}`);
				return;
			}

			// Only allow movement when phase is ACTIVE
			if (this.state.phase !== Phase.ACTIVE || this.playerLock) {
				return;
			}

			player.x += data.x;
			player.y += data.y;
			console.log(client.sessionId + ' at, x: ' + player.x, 'y: ' + player.y);

            player.zone = this.checkZone(player.x, player.y, player.radius);
		});

		// Called when client sends position update (for collision-based movements)
		this.onMessage('position', (client, data) => {
			const player = this.state.players.get(client.sessionId);

			if (!player) {
				console.error(`Player not found for session ${client.sessionId}`);
				return;
			}

			// Only allow movement when round is active
			// if (!this.state.roundActive) {
			// 	return;
			// }

			player.x = data.x;
			player.y = data.y;
            player.zone = this.checkZone(player.x, player.y);
		});

		// Called when client sends emote update
		this.onMessage('emote', (client, data) => {
			const player = this.state.players.get(client.sessionId);

			if (!player) {
				console.error(`Player not found for session ${client.sessionId}`);
				return;
			}

            // Only allow emotes when phase is ACTIVE
			if (this.state.phase !== Phase.ACTIVE || this.playerLock) {
				return;
			}

			player.emote = data.emote;

			// Check if this player already has an active emote timeout
			const existingTimeout = this.emoteTimeouts.get(client.sessionId);

			if (existingTimeout) {
				// Reset the existing timeout
				existingTimeout.reset();
			} else {
				// Create new timeout for this player
				const emoteTimeout = this.clock.setTimeout(() => {
					player.emote = "";
					this.emoteTimeouts.delete(client.sessionId);
				}, config.player.emoteTimeout);

				this.emoteTimeouts.set(client.sessionId, emoteTimeout);
			}
		});

        this.onMessage('ready', (client, data) => {
            const player = this.state.players.get(client.sessionId);

            if (this.playerLock) {
                return;
            }

            if (player) {
                player.ready = true;
            }
        });
	}

	// Called every time a client joins
	onJoin(client: Client, options: any) {
		console.log(client.sessionId, 'joined!');

		// Create new player with initialized properties
		const player = new Player();
		player.x = config.player.startX; // Start at center
		player.y = config.player.startY;
		player.name = options.name || `Player ${client.sessionId.slice(0, 4)}`;


		// Combine zone and player hues to ensure player colors are distinct from both zones and other players
		const allUsedHues = new Set([...this.zoneHues, ...this.playerHues]);
		player.color = this.generateDistinctColor(allUsedHues, config.player.minHueDifference);

		// The new hue was added to allUsedHues, so we need to find it and add to playerHues
		// by comparing the sets
		for (const hue of allUsedHues) {
			if (!this.zoneHues.has(hue) && !this.playerHues.has(hue)) {
				this.playerHues.add(hue);
				break;
			}
		}

		// Generate contrasting text color for readability
		player.textColor = this.getContrastingTextColor(player.color);
		player.emote = '';

		this.state.players.set(client.sessionId, player);

        // Prevent player movement if less than minimum connected clients
        this.checkPlayerCount();

		// Initialize round when first player joins
		if (!this.timerStarted) {
			this.state.roundTime = this.roundDuration;
            this.state.targetZone = randomInt(4);
            this.state.phase = Phase.WAITING;
			this.timerStarted = true;
			this.startRoundTimer(); // Start the timer logic, but it will only countdown when phase is ACTIVE
			this.waitForPlayerReady(); // Wait for all players to be ready before starting
		}
	}

	// Called when a client leaves
	onLeave(client: Client, _consented: boolean) {
		console.log(client.sessionId, 'left!');

		// Clear any active emote timeout for this player
		const emoteTimeout = this.emoteTimeouts.get(client.sessionId);
		if (emoteTimeout) {
			emoteTimeout.clear();
			this.emoteTimeouts.delete(client.sessionId);
		}

        this.checkPlayerCount();

		this.state.players.delete(client.sessionId);
	}

	// Helper method to generate distinct colors using HSL color space
	// This ensures colors are dramatically different in hue
	private generateDistinctColor(usedHues: Set<number>, minHueDifference: number = 60): string {
		const hueOptions: number[] = [];

		// Generate potential hues with good separation
		for (let hue = 0; hue < 360; hue += minHueDifference) {
			let isDistinct = true;
			for (const usedHue of usedHues) {
				const hueDiff = Math.min(
					Math.abs(hue - usedHue),
					360 - Math.abs(hue - usedHue)
				);
				if (hueDiff < minHueDifference) {
					isDistinct = false;
					break;
				}
			}
			if (isDistinct) {
				hueOptions.push(hue);
			}
		}

		// If no distinct hues available, reduce the minimum difference
		if (hueOptions.length === 0 && minHueDifference > config.player.minHueDifferenceFallback) {
			return this.generateDistinctColor(usedHues, minHueDifference - 10);
		}

		// Select random hue from available options
		const selectedHue = hueOptions.length > 0
			? hueOptions[Math.floor(Math.random() * hueOptions.length)]
			: Math.floor(Math.random() * 360);

		usedHues.add(selectedHue);

		// Use high saturation and medium lightness for vibrant colors
		const saturation = config.colors.saturation.min + Math.random() * (config.colors.saturation.max - config.colors.saturation.min);
		const lightness = config.colors.lightness.min + Math.random() * (config.colors.lightness.max - config.colors.lightness.min);

		return this.hslToHex(selectedHue, saturation, lightness);
	}

	// Helper method to convert HSL to hex color
	private hslToHex(h: number, s: number, l: number): string {
		s /= 100;
		l /= 100;

		const c = (1 - Math.abs(2 * l - 1)) * s;
		const x = c * (1 - Math.abs((h / 60) % 2 - 1));
		const m = l - c / 2;

		let r = 0, g = 0, b = 0;

		if (h >= 0 && h < 60) {
			r = c; g = x; b = 0;
		} else if (h >= 60 && h < 120) {
			r = x; g = c; b = 0;
		} else if (h >= 120 && h < 180) {
			r = 0; g = c; b = x;
		} else if (h >= 180 && h < 240) {
			r = 0; g = x; b = c;
		} else if (h >= 240 && h < 300) {
			r = x; g = 0; b = c;
		} else if (h >= 300 && h < 360) {
			r = c; g = 0; b = x;
		}

		const toHex = (value: number) => {
			const hex = Math.round((value + m) * 255).toString(16);
			return hex.length === 1 ? '0' + hex : hex;
		};

		return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
	}

	// Helper method to calculate contrasting text color (black or white)
	private getContrastingTextColor(hexColor: string): string {
		// Convert hex to RGB
		const r = parseInt(hexColor.slice(1, 3), 16);
		const g = parseInt(hexColor.slice(3, 5), 16);
		const b = parseInt(hexColor.slice(5, 7), 16);

		// Calculate relative luminance using WCAG formula
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

		// Return black for light backgrounds, white for dark backgrounds
		return luminance > 0.5 ? '#000000' : '#FFFFFF';
	}

    // Helper method to check player zone
    private checkZone(player_x: number, player_y: number, player_radius?: number): number {
        let zone_id: number = -1; 
        if (!player_radius) {
            player_radius = 0;
        }
        this.state.zones.forEach((zone, key) => {
            if (Math.hypot(Math.abs(player_x - zone.x), Math.abs(player_y - zone.y)) <= (zone.radius + player_radius)) {
                zone_id = zone.id;
            }
        });

        return zone_id;
    }

    // Helper method to create zone
    private makeZone(id: number, x: number, y: number, radius: number): Zone {
        const zone = new Zone();

        zone.id = id;
		zone.x = x;
		zone.y = y;
		zone.radius = radius;
		// Generate distinct color for zone with dramatic hue separation
		zone.color = this.generateDistinctColor(this.zoneHues, config.zones.minHueDifference);

        return zone;
    }

	// Start the round timer
	private startRoundTimer() {
		// Initialize timer to round duration
		this.state.roundTime = this.roundDuration;
		console.log(`Round timer initialized: ${this.roundDuration} seconds`);

		// Countdown every second, but only when phase is ACTIVE
		const roundTimer = this.clock.setInterval(() => {
			// Only countdown if phase is ACTIVE
			if (this.state.phase !== Phase.ACTIVE) {
				return;
			}

			this.state.roundTime -= 1;

			if (this.state.roundTime <= 0) {
				console.log('Round ended! Resetting room...');
                roundTimer.clear();
				this.endRound();
			}
		}, config.round.timerInterval);
	}

	// Reset the room to initial state
	private resetRoom() {
		console.log('Resetting room state...');

		// Reset all players to center and clear their state
		this.state.players.forEach((player) => {
			player.x = config.player.startX;
			player.y = config.player.startY;
			player.emote = '';
			player.zone = -1;
            player.ready = false;
            // Randomly inform players of the target zone
            if (randomInt(2) === 0) {
                player.informed = true;
            }
            else {
                player.informed = false;
            }
		})

        // set new target zone
        this.state.targetZone = randomInt(4);

		console.log('Room reset complete. Waiting for host to start next round.');
	}

    private scorePlayers() {
        this.state.players.forEach((player) => {
            if (player.zone === this.state.targetZone) {
                player.points += config.round.roundPoints
            }
        });
    }

    // Run this function when the round timer ends
    private endRound() {
        this.scorePlayers();
        this.state.phase = Phase.WAITING;
        this.checkPlayerCount();
        this.resetRoom();
        this.waitForPlayerReady();
        this.startRoundTimer();
    }

    async checkReady(): Promise<boolean> {
        let allReady: boolean = true;
        this.state.players.forEach((player) => {
            allReady = allReady && player.ready
        });
        return allReady;
    }

    private waitForPlayerReady() {
        const readyCheckInterval = this.clock.setInterval(async () => {
            const allReady = await this.checkReady();
            const hasPlayers = this.state.players.size > 0;
            if (allReady && hasPlayers) {
                readyCheckInterval.clear();
                this.state.players.forEach((player) => {
                    player.ready = false;
                });
                this.state.phase = Phase.ACTIVE;
            }
        }, 500);
        this.selectInformed();
    }

    private selectInformed(maxInformed: number = this.state.players.size * config.round.informedRatio) {
        maxInformed = Math.ceil(maxInformed);
        const playerArray = Array.from(this.state.players.values());
        const indices = Array.from({length: playerArray.length}, (_, i) => i);
        
        // Shuffle array using Fisher-Yates
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        
        // Take first maxInformed indices
        const informedIndices = new Set(indices.slice(0, maxInformed));
        
        playerArray.forEach((player, index) => {
            player.informed = informedIndices.has(index);
        });

        this.informedCount = maxInformed;
    }

    private checkPlayerCount() {
        if (this.clients.length < config.game.minClients && this.state.phase === Phase.WAITING) {
            this.playerLock = true;
        }
        else {
            this.playerLock = false;
        }
    }
}
