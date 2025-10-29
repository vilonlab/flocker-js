import Phaser from 'phaser';
import GameScene from './scenes/GameScene';
import { config as gameConfig } from './config';

import { BACKEND_HTTP_URL } from "./backend";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: gameConfig.game.width,
  height: gameConfig.game.height,
  parent: 'game-container',
  backgroundColor: gameConfig.game.backgroundColor,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: gameConfig.physics.gravity,
      debug: gameConfig.physics.debug
    }
  },
  scene: [GameScene]
};

const game = new Phaser.Game(config);
