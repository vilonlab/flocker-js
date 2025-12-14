/**
 * Server Configuration
 * Centralized configuration for all server-side game settings
 */

export const config = {

  // Game world settings
  world: {
    width: 1200,
    height: 800,
  },

  // Round settings
  round: {
    duration: 30, // seconds
    timerInterval: 1000, // ms - how often to update timer
    roundPoints: 1, // points earned if in target zone
    awareRatio: 0.5, // percentage of players aware each round
    scoreboardDuration: 5000, // ms - how long to show scoreboard
    readyTimeout: 10000, // time to wait for all players to ready at start of round, in ms
  },

  // Zone settings
  zones: {
    radius: 120,
    offsetFromCenter: 225, // distance from center
    minHueDifference: 90, // for distinct zone colors
  },

  // Player settings
  player: {
    radius: 20,
    startX: 600,
    startY: 400,
    minHueDifference: 60, // for distinct player colors
    minHueDifferenceFallback: 30, // when running out of colors
    emoteTimeout: 2000, // timeout for emote in ms
  },

  // Color generation settings
  colors: {
    saturation: {
      min: 70,
      max: 95,
    },
    lightness: {
      min: 45,
      max: 60,
    },
  },

  game : {
    maxClients: 5,
    minClients: 5,
    rounds: 5,
  },

  // Logging settings, in ms
  logging: {
    // snapshotInterval: 1000, // capture room state every second
    // snapshotInterval: 500, // capture room state 2x per second
    // snapshotInterval: 250, // 4x per second
    snapshotInterval: 100, // 10x per second

  },
} as const;

// Type for the config (useful for type checking)
export type ServerConfig = typeof config;
