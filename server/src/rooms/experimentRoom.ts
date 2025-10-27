import {Room, type Client} from 'colyseus';
import DataLogger from '../dataLogger';
import {Player, Zone, RoomState} from './schema/experimentSchema';

export class ExperimentRoom extends Room<RoomState> {
	state = new RoomState();
	logger = DataLogger.getInstance();
	private zoneHues = new Set<number>(); // Track hues used by zones
	private playerHues = new Set<number>(); // Track hues used by players

	onCreate(options: any) {
		console.log('ExperimentRoom created!', options);

		// Create four zones around the center of the screen
		const centerX = 400;
		const centerY = 300;
		const zoneRadius = 60;
		const offset = 200; // Distance from center

		// Left zone
        //makeZone(id: number, x: number, y: number, radius: number):
        const leftZone = this.makeZone(0, centerX - offset, centerY, zoneRadius);
        this.state.zones.set('left', leftZone);

        const rightZone = this.makeZone(1, centerX + offset, centerY, zoneRadius);
        this.state.zones.set('right', rightZone);

        const topZone = this.makeZone(2, centerX, centerY + offset, zoneRadius);
        this.state.zones.set('top', topZone);

        const bottomZone = this.makeZone(3, centerX, centerY - offset, zoneRadius);
        this.state.zones.set('bottom', bottomZone);

		// Set up periodic snapshot logging every 2 seconds
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
                    emote: player.emote
				})),
			});
		}, 2000); // Log every 2 seconds

		// Called every time this room receives a "move" message
		this.onMessage('move', (client, data) => {
			const player = this.state.players.get(client.sessionId);

			if (!player) {
				console.error(`Player not found for session ${client.sessionId}`);
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

			player.emote = data.emote;
		});
	}

	// Called every time a client joins
	onJoin(client: Client, options: any) {
		console.log(client.sessionId, 'joined!');

		// Create new player with initialized properties
		const player = new Player();
		player.x = 400; // Start at center
		player.y = 300;
		player.name = options.name || `Player ${client.sessionId.slice(0, 4)}`;

		// Combine zone and player hues to ensure player colors are distinct from both zones and other players
		const allUsedHues = new Set([...this.zoneHues, ...this.playerHues]);
		player.color = this.generateDistinctColor(allUsedHues, 60);

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
	}

	// Called when a client leaves
	onLeave(client: Client, _consented: boolean) {
		console.log(client.sessionId, 'left!');
		this.state.players.delete(client.sessionId);
	}

	// Helper method to generate random hex color
	private generateRandomColor(): string {
		const letters = '0123456789ABCDEF';
		let color = '#';
		for (let i = 0; i < 6; i++) {
			color += letters[Math.floor(Math.random() * 16)];
		}

		return color;
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
		if (hueOptions.length === 0 && minHueDifference > 30) {
			return this.generateDistinctColor(usedHues, minHueDifference - 10);
		}

		// Select random hue from available options
		const selectedHue = hueOptions.length > 0
			? hueOptions[Math.floor(Math.random() * hueOptions.length)]
			: Math.floor(Math.random() * 360);

		usedHues.add(selectedHue);

		// Use high saturation and medium lightness for vibrant colors
		const saturation = 70 + Math.random() * 25; // 70-95%
		const lightness = 45 + Math.random() * 15; // 45-60%

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
		zone.color = this.generateDistinctColor(this.zoneHues, 90);

        return zone;
    }
}
