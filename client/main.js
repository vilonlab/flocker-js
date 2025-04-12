import PreloadScene from './src/scenes/PreloadScene.js';
import GameScene from './src/scenes/GameScene.js';

const config = {
    type: Phaser.AUTO, // Use WebGL if available, otherwise Canvas
    width: 800,        // Arena width
    height: 600,       // Arena height
    parent: 'phaser-game', // ID of the div to contain the canvas
    backgroundColor: '#808080', // Neutral gray background
    physics: {
        default: 'arcade', // Using Arcade Physics for potential future use (like collisions)
        arcade: {
            // debug: true, // Set to true to see physics bodies
            gravity: { y: 0 }
        }
    },
    scene: [PreloadScene, GameScene] // Scenes registry
};

// Initialize the Phaser Game instance
const game = new Phaser.Game(config);

// Basic Admin Control Logic (Connect buttons to socket emits)
 window.addEventListener('load', () => {
     // Check if socket is available (GameScene should initialize it)
     // This is a bit hacky; ideally, UI logic is better integrated
     const checkSocketInterval = setInterval(() => {
         if (window.socket) { // Assuming GameScene puts socket on window for simplicity
             clearInterval(checkSocketInterval);

             const startGameBtn = document.getElementById('startGameBtn');
             const startRoundBtn = document.getElementById('startRoundBtn');

             if (startGameBtn) {
                 startGameBtn.addEventListener('click', () => {
                     console.log("Requesting Start Experiment...");
                     window.socket.emit('admin_startGame');
                 });
             }
             if (startRoundBtn) {
                 startRoundBtn.addEventListener('click', () => {
                      console.log("Requesting Start Round...");
                     window.socket.emit('admin_startRound');
                 });
             }
         }
     }, 100); // Check every 100ms
 });