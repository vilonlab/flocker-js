import Phaser from 'phaser';
import GameScene from './scenes/GameScene';
import LobbyScene from './scenes/LobbyScene'
import MMScene from './scenes/MMScene';
import EndScene from './scenes/EndScene';
import { config as gameConfig } from './config';

import { BACKEND_HTTP_URL } from "./backend";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: gameConfig.game.width,
  height: gameConfig.game.height,
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: gameConfig.physics.gravity,
      debug: gameConfig.physics.debug
    }
  },
  scene: [LobbyScene, GameScene, MMScene, EndScene]
};

/**
 * Function to get or set unique client ID cookie
 */
async function ensureClientId(): Promise<string> {
  try {
    // Check if cookie already exists in the browser
    let clientId = document.cookie
      .split('; ')
      .find(row => row.startsWith('clientId='))
      ?.split('=')[1];

    if (!clientId) {
      console.log('No client ID found, requesting from server...');
      // Make HTTP request to server to get/set unique ID
      const response = await fetch(`${BACKEND_HTTP_URL}/api/client-id`, {
        credentials: 'include' // Important: includes cookies in request/response
      });

      if (!response.ok) {
        throw new Error(`Failed to get client ID: ${response.status}`);
      }

      const data = await response.json();
      clientId = data.clientId;

      if (!clientId) {
        throw new Error('Server did not return a valid client ID');
      }

      console.log('Received new client ID from server:', clientId);
    } else {
      console.log('Found existing client ID:', clientId);
    }

    return clientId;
  } catch (error) {
    console.error('Error ensuring client ID:', error);
    throw error;
  }
}

// const game = new Phaser.Game(config);

// Ensure client ID is set before starting the game
ensureClientId()
  .then((clientId) => {
    console.log('Starting game with client ID:', clientId);
    const game = new Phaser.Game(config);
  })
  .catch((error) => {
    console.error('Failed to initialize game:', error);
    // You might want to show an error message to the user here
  });
