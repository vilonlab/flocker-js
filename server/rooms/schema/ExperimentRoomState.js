const schema = require('@colyseus/schema');
const Schema = schema.Schema;
const MapSchema = schema.MapSchema;
const type = schema.type;

class PlayerState extends Schema {
    constructor(options = {}) {
        super();
        this.name = options.name || `Player_${Math.floor(Math.random()*1000)}`;
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.color = options.color || 0xffffff;
        this.emoteColor = options.emoteColor || 0xffaa00;
        this.currentEmote = options.currentEmote || null;
        this.role = options.role || 'uninformed';
        this.ready = options.ready || false; // For lobby readiness
        this.targetX = options.targetX || null; // Target position for movement
        this.targetY = options.targetY || null;
    }
}
type("string")(PlayerState.prototype, "name");
type("number")(PlayerState.prototype, "x");
type("number")(PlayerState.prototype, "y");
type("number")(PlayerState.prototype, "color"); // Use number for hex tints
type("number")(PlayerState.prototype, "emoteColor");
type("string")(PlayerState.prototype, "currentEmote");
type("string")(PlayerState.prototype, "role");
type("boolean")(PlayerState.prototype, "ready");
type("number")(PlayerState.prototype, "targetX");
type("number")(PlayerState.prototype, "targetY");

class ZoneState extends Schema {
     constructor(id, x, y, radius) {
         super();
         this.id = id;
         this.x = x;
         this.y = y;
         this.radius = radius;
     }
 }
 type("string")(ZoneState.prototype, "id");
 type("number")(ZoneState.prototype, "x");
 type("number")(ZoneState.prototype, "y");
 type("number")(ZoneState.prototype, "radius");


class ExperimentRoomState extends Schema {
    constructor() {
        super();
        this.phase = "lobby"; // lobby, instructions, starting, active, round_end, finished
        this.roundNumber = 0;
        this.targetZone = null;
        this.roundEndTime = 0;
        this.score = 0;
        this.instructionText = "Waiting for players to join...";
         this.players = new MapSchema(); // Keyed by client.sessionId
        console.log("Current players state:", this.players);
         this.zones = new MapSchema(); // Keyed by zone ID ('Top', 'Right', etc.)
         this.lobbyMessage = "Welcome! Please wait for the experiment to begin."; // Message shown in lobby
    }
}
type("string")(ExperimentRoomState.prototype, "phase");
type("number")(ExperimentRoomState.prototype, "roundNumber");
type("string")(ExperimentRoomState.prototype, "targetZone");
type("number")(ExperimentRoomState.prototype, "roundEndTime"); // Store as timestamp
type("number")(ExperimentRoomState.prototype, "score");
type("string")(ExperimentRoomState.prototype, "instructionText");
type({ map: PlayerState })(ExperimentRoomState.prototype, "players");
type({ map: ZoneState })(ExperimentRoomState.prototype, "zones");
type("string")(ExperimentRoomState.prototype, "lobbyMessage");


module.exports = { ExperimentRoomState, PlayerState, ZoneState }; // Export classes