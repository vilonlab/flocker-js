/**
 * Game Configuration
 * Centralized configuration for all game settings
 */

export const config = {
  // Game window settings
  game: {
    width: 800,
    height: 600,
    backgroundColor: '#ffffff',
  },

  // Physics settings
  physics: {
    gravity: {
      x: 0,
      y: 0,
    },
    debug: false,
  },

  // Player settings
  player: {
    speed: 300,
    radius: 20, // Default player radius (can be overridden by server)
  },

  // Network update settings
  network: {
    positionUpdateThreshold: 5, // Only send update if position differs by more than this many pixels
    positionUpdateInterval: 100, // Throttle: send updates at most every N ms
    collisionUpdateInterval: 50, // Throttle collision updates (can be different from position updates)
  },

  // UI settings
  ui: {
    debug: {
      color: '#ff0000',
      fontSize: '16px',
      position: { x: 0, y: 0 },
    },
    timer: {
      color: '#ff0000',
      fontSize: '16px',
      position: { x: 400, y: 0 },
      prefix: 'Round Time: ',
    },
    playerText: {
      fontSize: '24px',
      fontStyle: 'bold',
    },
  },

  // Zone rendering settings
  zones: {
    opacity: 0.2,
    targetWidth: 3,
    targetColor: 0xFFF700,
  },

  // Lobby settings
  lobby: {
    numPlayers: 25,
    speed: 4,
  },

  // Emote key bindings
  emotes: {
    ONE: '?',
    TWO: '!',
    THREE: '+',
    FOUR: '-',
  },
} as const;

// Type for the config (useful for type checking)
export type GameConfig = typeof config;
