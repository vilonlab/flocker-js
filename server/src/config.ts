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
    scoreboardDuration: 5000, // ms - how long to show scoreboard
    readyTimeout: 10000, // time to wait for all players to ready before round 1, in ms
    countdownDuration: 10, // seconds - fixed delay before rounds after the first begin (no ready-up)
  },

  // Zone settings
  zones: {
    radius: 120,
    offsetFromCenter: 225, // distance from center
    colors: [  // colors for zones
      '#0373fc',
      '#bd0000',
      '#009c12',
      '#fff82b',
    ],
  },

  // Player settings
  player: {
    radius: 30,
    startX: 600,
    startY: 400,
    spawnRadius: 100, // distance from center players are spread out to when spawned, so they don't start overlapping
    minHueDifference: 60, // for distinct player colors
    minHueDifferenceFallback: 30, // when running out of colors
    emoteTimeout: 2000, // timeout for emote in ms
    maxSpeed: 120, // max movement speed, in pixels per second, enforced server-side regardless of message rate
    speedBurstMs: 200, // ms worth of movement that can be "banked" while idle, to absorb frame/network jitter without allowing hoarding
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
    maxClients: 2,
    minClients: 2,
    rounds: 5,
    randomAware: false, // randomly assign new aware players each round
    awareMin: 0.1, // starting proportion of aware players
    awareMax: 1.0 // ending proportion of aware players 
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
