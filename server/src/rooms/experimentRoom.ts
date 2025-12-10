import {Room, type Client} from 'colyseus';
import DataLogger from '../dataLogger';
import {Player, Zone, RoomState, Phase} from './schema/experimentSchema';
import {config} from '../config';
import { randomInt } from 'node:crypto';
import {generateDistinctColor, getContrastingTextColor} from '../utils';
import { faker } from '@faker-js/faker';
import { kMaxLength } from 'node:buffer';
import { ad } from '@faker-js/faker/dist/airline-DF6RqYmq';

export class ExperimentRoom extends Room<RoomState> {
	state = new RoomState();
	logger = DataLogger.getInstance();
    maxClients: number = config.game.maxClients;

	private zoneHues = new Set<number>(); // Track hues used by zones
	private playerHues = new Set<number>(); // Track hues used by players
	private roundTimer: any = null; // Track the round timer interval
	private roundDuration = config.round.duration; // Round duration in seconds
	private emoteTimeouts = new Map<string, any>(); // Track emote timeouts per player
    private playerLock = true; // Prevent players from moving or using emotes
	private lastRound = config.game.rounds;

	// Called when first player connects
	onCreate(options: any) {
		console.log('ExperimentRoom created!', options);

		this.registerMessageListeners(); // Register onMessage listeners 
		this.initializeZones(); // Create zones
		this.state.phase = Phase.LOBBY; // Set initial phase
	
        this.clock.start(); // Start room clock, used for async events
	}

	// Called every time a client joins
	onJoin(client: Client, options: any) {
		console.log(client.sessionId, 'joined!');

		// Create new player with initialized properties
		const player = new Player();
		player.x = config.player.startX; // Start at center
		player.y = config.player.startY;
		// player.name = options.name || `Player ${client.sessionId.slice(0, 4)}`;
		const adjective = faker.word.adjective({ length: { min: 5, max: 7 }, strategy: "closest" });
		const noun = faker.word.noun({ length: { min: 5, max: 7 }, strategy: "closest" });
		// Capitalize first letter of each word
		const capitalizedAdjective = adjective.charAt(0).toUpperCase() + adjective.slice(1);
		const capitalizedNoun = noun.charAt(0).toUpperCase() + noun.slice(1);
		player.name = `${capitalizedAdjective}${capitalizedNoun}`;		

		// Combine zone and player hues to ensure player colors are distinct from both zones and other players
		const allUsedHues = new Set([...this.zoneHues, ...this.playerHues]);
		player.color = generateDistinctColor(allUsedHues, config.player.minHueDifference);

		// The new hue was added to allUsedHues, so we need to find it and add to playerHues
		// by comparing the sets
		for (const hue of allUsedHues) {
			if (!this.zoneHues.has(hue) && !this.playerHues.has(hue)) {
				this.playerHues.add(hue);
				break;
			}
		}

		// Generate contrasting text color for readability
		player.textColor = getContrastingTextColor(player.color);
		player.emote = '';

		this.state.players.set(client.sessionId, player);

		if (this.state.phase === Phase.LOBBY &&
			this.clients.length >= config.game.minClients) {
			this.transitionFromLobby();
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

	// Helper method to check player zone
	private checkZone(player_x: number, player_y: number, player_radius?: number): number {
		let zone_id: number = -1;
		if (!player_radius) {
			player_radius = 0;
		}
		this.state.zones.forEach((zone) => {
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
		zone.color = generateDistinctColor(this.zoneHues, config.zones.minHueDifference);

        return zone;
    }

	// Start the round timer
	private startRoundTimer() {
		// Always reset the timer value
		this.state.roundTime = this.roundDuration;

		// If timer is already running, just reset the value and return
		if (this.roundTimer) {
			return;
		}

		console.log(`Round timer initialized: ${this.roundDuration} seconds`);

		// Create the countdown interval
		this.roundTimer = this.clock.setInterval(() => {
			// Only countdown if phase is ACTIVE
			if (this.state.phase !== Phase.ACTIVE) {
				return;
			}

			this.state.roundTime -= 1;

			if (this.state.roundTime <= 0) {
				console.log('Round ended! Resetting room...');
				this.roundTimer.clear();
				this.roundTimer = null; // Clear the reference so it can be restarted
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
		})

		console.log('Room reset complete. Waiting for host to start next round.');
		// this.state.phase = Phase.END;
		console.log(`Current phase: ${this.state.phase}`);
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

        // Determine round scores, give winning players points
        this.scorePlayers();

        // Set room phase to SCOREBOARD to display the scoreboard
        this.state.phase = Phase.SCOREBOARD;

        // Wait for scoreboard duration before transitioning to next round
        this.clock.setTimeout(() => {
            // Set room phase to WAITING, preventing the room counter from starting
            this.state.phase = Phase.WAITING;

            // Reset player variables, choose new target zone, update informed
            this.resetRoom();

            // Start next round
            this.startRound();
        }, config.round.scoreboardDuration);
    }

    // Run this function at the end of end round, separate logic for starting new game
    private startRound() {
		if (this.state.roundNumber >= this.lastRound - 1) {
			console.log('Final round');
			this.state.phase = Phase.END;
			// this.endGame();
			return;
		}

		// Increment round count
		this.state.roundNumber += 1;
		console.log('Current round: ', this.state.roundNumber);

        // Select informed players
        this.selectInformed();




		this.state.phase = Phase.WAITING;
		console.log(`Current phase: ${this.state.phase}`);

        // Wait for all players to be ready
        this.waitForPlayerReady();

        // Start round and timer 
        this.startRoundTimer();

		// Set new target zone
		this.state.targetZone = randomInt(4);
    }

    async checkReady(): Promise<boolean> {
        let allReady: boolean = true;
        this.state.players.forEach((player) => {
            allReady = allReady && player.ready
        });
        return allReady;
    }

    private async waitForPlayerReady() {
        // Create promise that resolves when all players are ready
        const readyCheckPromise = new Promise<void>((resolve) => {
            const readyCheckInterval = this.clock.setInterval(async () => {
                const allReady = await this.checkReady();
                const hasPlayers = this.state.players.size > 0;
                if (allReady && hasPlayers) {
                    readyCheckInterval.clear();
                    resolve();
                }
            }, 500);
        });

        // Create promise that resolves after 10 seconds
        const timeoutPromise = new Promise<void>((resolve) => {
            this.clock.setTimeout(() => {
                console.log('Ready timeout expired (10s), starting round anyway');
                resolve();
            }, config.round.readyTimeout);
        });

		console.log('Awaiting ready promises');

        // Wait for whichever happens first: all ready or timeout
        await Promise.race([readyCheckPromise, timeoutPromise]);
		console.log('Promise resolved');

        // Reset ready state and unlock players
        this.state.players.forEach((player) => {
            player.ready = false;
        });
        this.playerLock = false;
        this.state.phase = Phase.ACTIVE;
    }

    private checkPlayerCount() {
        if (this.clients.length < config.game.minClients && (this.state.phase === Phase.WAITING || this.state.phase === Phase.LOBBY)) {
            this.playerLock = true;
        }
        else {
            this.playerLock = false;
        }
    }

	private registerMessageListeners() {

        // Ready all players for debugging from Colyseus playground
        this.onMessage('ready-all', (client, data) => {
            this.state.players.forEach((player) => {
                player.ready = true;
            });
        });

		// Called every time this room receives a "move" message
		this.onMessage('move', (client, data) => {
			const player = this.state.players.get(client.sessionId);
			var adj_x = 0;
			var adj_y = 0;

			if (!player) {
				console.error(`Player not found for session ${client.sessionId}`);
				return;
			}

			// Only allow movement when phase is ACTIVE
			if (this.state.phase !== Phase.ACTIVE || this.playerLock) {
				return;
			}

			if (data.x && data.y) {
				adj_x = Math.round((data.x * Math.sqrt(2) / 2)*100) / 100;
				adj_y = Math.round((data.y * Math.sqrt(2) / 2)*100) / 100;
			} else {
				adj_x = data.x;
				adj_y = data.y;
			}
			player.x += adj_x;
			player.y += adj_y;

			console.log(client.sessionId + ' at, x: ' + player.x, 'y: ' + player.y);

			// Add new distance to total player distance
			player.distance += Math.abs(data.x) + Math.abs(data.y);

			// Clamp player position to world bounds (accounting for player radius)
			const minX = player.radius;
			const maxX = config.world.width - player.radius;
			const minY = player.radius;
			const maxY = config.world.height - player.radius;

			player.x = Math.max(minX, Math.min(maxX, player.x));
			player.y = Math.max(minY, Math.min(maxY, player.y));

            player.zone = this.checkZone(player.x, player.y, player.radius);
		});

		// // Called when client sends position update (for collision-based movements)
		// this.onMessage('position', (client, data) => {
		// 	const player = this.state.players.get(client.sessionId);

		// 	if (!player) {
		// 		console.error(`Player not found for session ${client.sessionId}`);
		// 		return;
		// 	}

		// 	// Only allow movement when round is active
		// 	// if (!this.state.roundActive) {
		// 	// 	return;
		// 	// }

		// 	player.x = data.x;
		// 	player.y = data.y;
        //     player.zone = this.checkZone(player.x, player.y);
		// });

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

			// Increment the emote count when the emote changes
			if (player.emote != data.emote) {
				player.emoteCount += 1;
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

            if (player) {
                player.ready = true;
            }

            // Calculate ready count
            const readyCount = Array.from(this.state.players.values()).filter(p => p.ready).length;
            const totalCount = this.state.players.size;

            // Broadcast to ALL clients including the sender
            this.broadcast("ready-count", { ready: readyCount, total: totalCount });
        });
	}

	// Create four zones around the center of the screen
	private initializeZones() {
		
		// const centerX = config.world.centerX;
		// const centerY = config.world.centerY;
		const centerX = config.world.width / 2;
		const centerY = config.world.height / 2;
		const zoneRadius = config.zones.radius;
		const offset = config.zones.offsetFromCenter;

        const leftZone = this.makeZone(0, centerX - offset, centerY, zoneRadius);
        this.state.zones.set('left', leftZone);

        const rightZone = this.makeZone(1, centerX + offset, centerY, zoneRadius);
        this.state.zones.set('right', rightZone);

        const topZone = this.makeZone(2, centerX, centerY + offset, zoneRadius);
        this.state.zones.set('top', topZone);

        const bottomZone = this.makeZone(3, centerX, centerY - offset, zoneRadius);
        this.state.zones.set('bottom', bottomZone);
	}

	// Set up periodic snapshot logging
	private initializeLogger() {
		this.clock.setInterval(() => {
			if (this.state.phase === Phase.ACTIVE){ // Only log snapshot if phase is ACTIVE
				this.logger.logSnapshot({
					timestamp: this.clock.currentTime, // Colyseus simulation time
					serverTime: Date.now(), // Real-world timestamp
					roomId: this.roomId,
					// roundNumber: this.state.roundNumber,
					// phase: this.state.phase,
					targetZone: this.state.targetZone?.toString(),
					players: [...this.state.players.entries()].map(([sessionId, player]) => ({
						id: sessionId,
						x: player.x,
						y: player.y,
						informed: player.informed,
						name: player.name,
						color: player.color,
						textColor: player.textColor,
						emote: player.emote,
						zone: player.zone,
						points: player.points,
						ready: player.ready
					})),
				});
			}
		}, config.logging.snapshotInterval);
	}

	// Call once minimum players connect, start the game
	private transitionFromLobby() {
		this.initializeLogger(); // Start logger
		this.state.phase = Phase.WAITING; // Set phase to WAITING
		this.state.targetZone = randomInt(4); // Set random target zone
		this.startRoundTimer(); // Start round timer
		this.resetRoom();
		this.waitForPlayerReady(); // Wait for all players to ready before starting round
		this.selectInformed();
	}
}

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
