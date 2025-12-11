import {type, Schema, MapSchema} from '@colyseus/schema';
import {config} from '../../config';

enum Phase {
    ACTIVE,
    WAITING,
    SCOREBOARD,
	LOBBY,
	END
}

class Player extends Schema {
	@type('number') x = 0;
	@type('number') y = 0;
	@type('string') name = '';
	@type('string') color = '#000000';
	@type('string') textColor = '#FFFFFF';
	@type('number') points = 0;
	@type('string') emote = '';
    @type('number') zone = -1;
    @type('number') radius = config.player.radius;
    @type('boolean') host = false;
    @type('boolean') informed = false;
    @type('boolean') ready = false;
	@type('number') distance = 0;
	@type('number') emoteCount = 0;
	@type('number') roundPoints = 0;
}

class Zone extends Schema {
	@type('string') color = '#000000';
	@type('number') id = 0;
	@type('number') radius = 0;
	@type('number') x = 0;
	@type('number') y = 0;
    @type('boolean') isTarget = false;
}

class RoomState extends Schema {
	@type({map: Player}) players = new MapSchema<Player>();
	@type('number') roundTime = 0;
	@type({map: Zone}) zones = new MapSchema<Zone>();
    @type('number') targetZone = -1;
    @type(Phase) phase = Phase.ACTIVE;
    @type('number') minClients = config.game.minClients;
	@type('number') roundNumber = 0;
	@type('number') totalRounds = config.game.rounds;
	@type('number') collectiveScore = 0;
	@type('boolean') isCollectiveScoring = false;
}


export {Player, Zone, RoomState, Phase};
