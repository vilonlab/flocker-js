import {type, Schema, MapSchema} from '@colyseus/schema';
import {config} from '../../config';

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
}

class Zone extends Schema {
	@type('string') color = '#000000';
	@type('number') id = 0;
	@type('number') radius = 0;
	@type('number') x = 0;
	@type('number') y = 0;
}

class RoomState extends Schema {
	@type({map: Player}) players = new MapSchema<Player>();
	@type('number') roundTime = 0;
	@type({map: Zone}) zones = new MapSchema<Zone>();
}

export {Player, Zone, RoomState};
