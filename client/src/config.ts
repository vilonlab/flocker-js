/**
 * Game Configuration
 * Centralized configuration for all game settings
 */

export const config = {

  // Game window settings -- must match Colyseus variables
  game: {
    width: 1200,
    height: 800,
    backgroundColor: '#ffffff',
    texturePack: 'space',
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
    speed: 2,
    radius: 30, // Default player radius (can be overridden by server)
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
      show: true,
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
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
    },
    scoreboard: {
      showPlayers: true,
    }
  },

  // Zone rendering settings
  zones: {
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
    FOUR: 'x',
  },
} as const;

// Type for the config (useful for type checking)
export type GameConfig = typeof config;
