import { RoomState } from '../rooms/schema/experimentSchema';
import { ScoringStrategyConfig } from './types';
import { config } from '../config';

/**
 * Collection of scoring strategies for the game
 * Each strategy defines how players earn points based on game state
 */
export const scoringStrategies: Record<string, ScoringStrategyConfig> = {
  ZONE_ONLY: {
    name: 'Individual Zone Scoring',
    objective: 'Get to the target zone to earn points for yourself.',
    isCollective: false,
    calculate: (players, state) => {
      const scores = new Map<string, number>();

      players.forEach((player, sessionId) => {
        const points = player.zone === state.targetZone ? config.round.roundPoints : 0;
        scores.set(sessionId, points);
      });

      return {
        individualScores: scores,
      };
    },
  },

  COLLECTIVE_ZONE_COUNT: {
    name: 'Collective Zone Scoring',
    objective: 'Earn points as a team. Everyone earns a point for each player in the target zone.',
    isCollective: true,
    calculate: (players, state) => {
      const scores = new Map<string, number>();

      // Count how many players are in the target zone
      const playersInZone = Array.from(players.values())
        .filter(p => p.zone === state.targetZone).length;

      // Everyone gets the same collective score
      players.forEach((player, sessionId) => {
        scores.set(sessionId, player.zone === state.targetZone ? 1 : 0);
      });

      return {
        individualScores: scores,
        collectiveScore: playersInZone,  // collective pool also increases
      };
    },
  },
};
