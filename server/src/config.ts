/**
 * Server Configuration
 * Centralized configuration for all server-side game settings
 */

export const config = {
  // Game world settings
  world: {
    centerX: 400,
    centerY: 300,
    width: 800,
    height: 600,
  },

  // Round settings
  round: {
    duration: 15, // seconds
    timerInterval: 1000, // ms - how often to update timer
    roundPoints: 1, // points earned if in target zone
    informedRatio: 0.5, // percentage of players informed each round
  },

  // Zone settings
  zones: {
    radius: 80,
    offsetFromCenter: 200, // distance from center
    minHueDifference: 90, // for distinct zone colors
  },

  // Player settings
  player: {
    radius: 20,
    startX: 400,
    startY: 300,
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
    maxClients: 6,
    minClients: 2,
  },

  // Logging settings
  logging: {
    snapshotInterval: 2000, // ms - how often to log snapshots
  },
} as const;

// Type for the config (useful for type checking)
export type ServerConfig = typeof config;
