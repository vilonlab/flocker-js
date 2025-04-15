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
        this.load.image('player', 'assets/player.png');
        this.load.image('zone', 'assets/zone.png');
        this.load.spritesheet('emotes', 'assets/emotes.png', {
            frameWidth: 32,
            frameHeight: 32
        });
    }

    create() {
        console.log("PreloadScene: Create - Starting GameScene.");

        // Add animations for emotes
        if (this.textures.exists('emotes')) {
            this.anims.create({ key: 'emote_!', frames: this.anims.generateFrameNumbers('emotes', { start: 0, end: 0 }) });
            this.anims.create({ key: 'emote_+', frames: this.anims.generateFrameNumbers('emotes', { start: 1, end: 1 }) });
            this.anims.create({ key: 'emote_x', frames: this.anims.generateFrameNumbers('emotes', { start: 2, end: 2 }) });
            this.anims.create({ key: 'emote_?', frames: this.anims.generateFrameNumbers('emotes', { start: 3, end: 3 }) });
        } else {
            console.error("Emotes texture not found!");
        }

        // Start the main game scene
        this.scene.start('GameScene');

        // Resume AudioContext after user interaction
        this.input.once('pointerdown', () => {
            if (this.sound.context.state === 'suspended') {
                this.sound.context.resume();
            }
        });
    }
}