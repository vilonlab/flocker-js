import {type, Schema, MapSchema} from '@colyseus/schema';

type PlayerStateOptions = {
	name?: string;
	x?: number;
	y?: number;
	color?: number;
	emoteColor?: number;
	currentEmote?: string | undefined;
	role?: string;
	ready?: boolean;
	targetX?: number | undefined;
	targetY?: number | undefined;
};

type ZoneStateOptions = {
	id: string;
	x: number;
	y: number;
	radius: number;
};

class PlayerState extends Schema {
	@type('string') declare name: string;
	@type('number') declare x: number;
	@type('number') declare y: number;
	@type('number') declare color: number;
	@type('number') declare emoteColor: number;
	@type('string') declare currentEmote: string | undefined;
	@type('string') declare role: string;
	@type('boolean') declare ready: boolean;
	@type('number') declare targetX: number | undefined;
	@type('number') declare targetY: number | undefined;

	constructor(options: PlayerStateOptions = {}) {
		super();
		this.name = options.name || `Player_${Math.floor(Math.random() * 1000)}`;
		this.x = options.x || 0;
		this.y = options.y || 0;
		this.color = options.color || 0xFF_FF_FF;
		this.emoteColor = options.emoteColor || 0xFF_AA_00;
		this.currentEmote = options.currentEmote ?? null;
		this.role = options.role || 'uninformed';
		this.ready = options.ready || false;
		this.targetX = options.targetX ?? null;
		this.targetY = options.targetY ?? null;
	}
}

class ZoneState extends Schema {
	@type('string') declare id: string;
	@type('number') declare x: number;
	@type('number') declare y: number;
	@type('number') declare radius: number;

	constructor(options: ZoneStateOptions) {
		super();
		this.id = options.id;
		this.x = options.x;
		this.y = options.y;
		this.radius = options.radius;
	}
}

class ExperimentRoomState extends Schema {
	@type('string') declare phase: string;
	@type('number') declare roundNumber: number;
	@type('string') declare targetZone: string | undefined;
	@type('number') declare roundEndTime: number;
	@type('number') declare score: number;
	@type('string') declare instructionText: string;
	@type({map: PlayerState}) declare players: MapSchema<PlayerState>;
	@type({map: ZoneState}) declare zones: MapSchema<ZoneState>;
	@type('string') declare lobbyMessage: string;

	constructor() {
		super();
		this.phase = 'lobby';
		this.roundNumber = 0;
		this.targetZone = null;
		this.roundEndTime = 0;
		this.score = 0;
		this.instructionText = 'Waiting for players to join...';
		this.players = new MapSchema<PlayerState>();
		this.zones = new MapSchema<ZoneState>();
		this.lobbyMessage = 'Welcome! Please wait for the experiment to begin.';
	}
}

export {ExperimentRoomState, PlayerState, ZoneState};
