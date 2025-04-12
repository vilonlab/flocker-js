export default class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        console.log("PreloadScene: Preloading assets...");

        // Display a loading message
        let loadingText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 - 50, 'Loading...', { font: '20px Arial', fill: '#ffffff' });
        loadingText.setOrigin(0.5, 0.5);
        let percentText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, '0%', { font: '18px Arial', fill: '#ffffff' });
        percentText.setOrigin(0.5, 0.5);
        let assetText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 50, '', { font: '18px Arial', fill: '#ffffff' });
        assetText.setOrigin(0.5, 0.5);

        // Update loading progress text
        this.load.on('progress', function (value) {
            percentText.setText(parseInt(value * 100) + '%');
        });

        // Update asset being loaded text
        this.load.on('fileprogress', function (file) {
            assetText.setText('Loading asset: ' + file.key);
        });

        // Remove texts when loading complete
        this.load.on('complete', function () {
            console.log("PreloadScene: Asset loading complete.");
            loadingText.destroy();
            percentText.destroy();
            assetText.destroy();
        });


        // Load assets
        this.load.image('player', 'assets/player.png'); // Simple circle sprite for player
        this.load.image('zone', 'assets/zone.png');     // Simple circle sprite for zone

        // Load emote spritesheet (replace 'emotes.png' with your actual file)
        // Assuming a 32x32 sprite sheet with 4 frames horizontally: !, +, x, ?
        this.load.spritesheet('emotes', 'assets/emotes.png', {
             frameWidth: 32, // Adjust to your emote sprite size
             frameHeight: 32 // Adjust to your emote sprite size
         });

        // --- Placeholder Asset Creation (if you don't have images yet) ---
        // Create dynamic textures if files don't exist (useful for quick setup)
         if (!this.textures.exists('player')) {
             let graphics = this.make.graphics().fillStyle(0xffffff).fillCircle(10, 10, 10);
             graphics.generateTexture('player', 20, 20);
             graphics.destroy();
             console.log("Generated placeholder 'player' texture.");
         }
         if (!this.textures.exists('zone')) {
            let graphics = this.make.graphics().fillStyle(0xffffff).fillCircle(50, 50, 50); // White circle
            graphics.lineStyle(2, 0xaaaaaa); // Add a border maybe
            graphics.strokeCircle(50, 50, 50);
            graphics.generateTexture('zone', 100, 100);
            graphics.destroy();
            console.log("Generated placeholder 'zone' texture.");
         }
         if (!this.textures.exists('emotes')) {
            // Create a dummy spritesheet texture (e.g., 4 colored squares)
             let graphics = this.make.graphics();
             graphics.fillStyle(0xff0000).fillRect(0, 0, 32, 32);    // Frame 0 (Red) !
             graphics.fillStyle(0x00ff00).fillRect(32, 0, 32, 32);   // Frame 1 (Green) +
             graphics.fillStyle(0x0000ff).fillRect(64, 0, 32, 32);   // Frame 2 (Blue) x
             graphics.fillStyle(0xffff00).fillRect(96, 0, 32, 32);   // Frame 3 (Yellow) ?
             graphics.generateTexture('emotes', 128, 32);
             graphics.destroy();
             console.log("Generated placeholder 'emotes' spritesheet texture.");
         }
         // Ensure the generated textures are loaded if needed elsewhere immediately
         this.load.image('player');
         this.load.image('zone');
         this.load.spritesheet('emotes', { frameWidth: 32, frameHeight: 32 });


    }

    create() {
        console.log("PreloadScene: Create - Starting GameScene.");
        // Add animations for emotes if using spritesheet
        // Frame indices correspond to !, +, x, ?
         this.anims.create({ key: 'emote_!', frames: this.anims.generateFrameNumbers('emotes', { start: 0, end: 0 }) });
         this.anims.create({ key: 'emote_+', frames: this.anims.generateFrameNumbers('emotes', { start: 1, end: 1 }) });
         this.anims.create({ key: 'emote_x', frames: this.anims.generateFrameNumbers('emotes', { start: 2, end: 2 }) });
         this.anims.create({ key: 'emote_?', frames: this.anims.generateFrameNumbers('emotes', { start: 3, end: 3 }) });

        // Start the main game scene
        this.scene.start('GameScene');
    }
}