import { RoomState } from '../rooms/schema/experimentSchema';
import { ScoringStrategy } from './types';
import { config } from '../config';

/**
 * Collection of scoring strategies for the game
 * Each strategy defines how players earn points based on game state
 */
export const scoringStrategies = {
  /**
   * ZONE_ONLY: Individual scoring based on zone position
   * Players earn points if they are in the target zone
   */
  ZONE_ONLY: ((players, state) => {
    const scores = new Map<string, number>();

    players.forEach((player, sessionId) => {
      const points = player.zone === state.targetZone ? config.round.roundPoints : 0;
      scores.set(sessionId, points);
    });

    return { 
      individualScores: scores,
     };
  }) as ScoringStrategy,

  /**
   * COLLECTIVE_ZONE_COUNT: Collective scoring
   * All players earn points equal to the number of players in the target zone
   * Also increments the collective score
   */
  COLLECTIVE_ZONE_COUNT: ((players, state) => {
    const scores = new Map<string, number>();

    // Count how many players are in the target zone
    const playersInZone = Array.from(players.values())
      .filter(p => p.zone === state.targetZone).length;

    // Everyone gets the same collective score
    players.forEach((player, sessionId) => {
      scores.set(sessionId, player.zone === state.targetZone ? 1 : 0);
    });

    const isCollective = true;

    return {
      individualScores: scores,
      collectiveScore: playersInZone,  // collective pool also increases
    };
  }) as ScoringStrategy,
};
