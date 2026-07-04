import { MapSchema } from '@colyseus/schema';
import { Player, RoomState } from '../rooms/schema/experimentSchema';

/**
 * Result of a scoring strategy calculation
 */
export type ScoringResult = {
  individualScores: Map<string, number>;  // sessionId -> points to add
  collectiveScore?: number;                // optional collective points to add
};

/**
 * A scoring strategy function that calculates scores for all players
 * based on the current game state
 */
export type ScoringStrategy = (
  players: MapSchema<Player>,
  gameState: RoomState,
) => ScoringResult;

/**
 * Configuration for a scoring strategy including metadata and behavior
 */
export interface ScoringStrategyConfig {
  /** Human-readable name of the strategy */
  name: string;

  /** Objective/instructions shown to players explaining the goal */
  objective: string;

  /** The scoring calculation function */
  calculate: ScoringStrategy;

  /** Whether this strategy uses collective scoring */
  isCollective: boolean;
}
