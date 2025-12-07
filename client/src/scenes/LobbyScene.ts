import Phaser from "phaser";
import * as Colyseus from 'colyseus.js';
import { BACKEND_HTTP_URL, BACKEND_URL } from "../backend";
import { Player, Zone, RoomState, Phase } from '../../../server/src/rooms/schema/experimentSchema';
import { config } from '../config';
import { getRandomColor } from '../helpers';


export default class LobbyScene extends Phaser.Scene {

    // Colyseus properties
    rooms: {[roomId: string]: Colyseus.Room<RoomState>} = {};
    sprites: {s: Phaser.GameObjects.Image, t: number, x: number, y:number}[] = [];

    parts = {
        '1': ["Join", "experiment"],
        // '2': ["Other", ""],
    };

    constructor() { 
        super({ key: "lobby", active: true });
        this.sprites = [];
    }

    preload() {
        // this.load.setBaseURL('/home/gus/Documents/Programming/flocker-js/phaser-demo/src/assets');
        // const bg_url = new URL('space1.png', import.meta.url);
        const particle_url = new URL('../assets/base.png', import.meta.url);
        // this.load.image('bg', bg_url.toString());
        this.load.image('particle', particle_url.toString());
    }

    create() {

        // this.add.image(400, 300, 'bg');

        // Add title text
        const titleText = this.add.text(
            config.game.width / 2,
            config.game.height / 3,
            'flocker-js',
            {
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '64px',
                fontStyle: 'bold',
                color: '#ffffff'
            }
        );
        titleText.setOrigin(0.5, 0.5) // Center the text on its position
            .setDepth(10); // Above all other background sprites 

        // Add button to access admin panel
        const adminButton = this.add.text(
            20,
            config.game.height - 20,
            'Administrator access',
            {
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '32px',
                fontStyle: 'bold',
                color: '#0011ffff',
                padding: { x: 0, y: 0 }
            }
        );

        adminButton.setOrigin(0, 0)
            .setInteractive({ useHandCursor: true })
            .setDepth(10); 
        
        adminButton.on('pointerdown', () => {
            window.location.href = '/app/admin';
        });

        // Add join game button
        const joinButton = this.add.text(
            config.game.width / 2,
            config.game.height / 3 + 100,
            'Join Game',
            {
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '32px',
                fontStyle: 'bold',
                color: '#ffffff',
                backgroundColor: '#333333',
                padding: { x: 20, y: 10 }
            }
        );
        joinButton.setOrigin(0.5, 0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(10); 

        // Button hover effects
        joinButton.on('pointerover', () => {
            joinButton.setStyle({ backgroundColor: '#555555' });
        });
        joinButton.on('pointerout', () => {
            joinButton.setStyle({ backgroundColor: '#333333' });
        });
        joinButton.on('pointerdown', () => {
            this.runScene('mm');
        });

        // create background sprites
        for (var i = 0; i < config.lobby.numPlayers; i ++) {
            const start_x = Phaser.Math.Between(-64, 800);
            const start_y = Phaser.Math.Between(-64, 600);

            const image = this.add.image(start_x, start_y, 'particle');

            // image.setBlendMode(Phaser.BlendModes.ADD);
            image.setTint(getRandomColor());
            // image.setTint(0x00ff00);

            const index = this.sprites.push({s: image, t: Math.random() * 2 * Math.PI, x: start_x, y: start_y});
            console.log('Sprite created:', this.sprites[index-1].t);
        };

        // // automatically navigate to hash scene if provided
        // if (window.location.hash) {
        //     this.runScene(window.location.hash.substring(1));
        //     return;
        // }

        // const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
        //     color: "#ff0000",
        //     fontSize: "32px",
        //     // fontSize: "24px",
        //     fontFamily: "Arial"
        // };

        // for (let partNum in this.parts) {
        //     const index = parseInt(partNum) - 1;
        //     const label = this.parts[partNum as keyof typeof this.parts][0];

        //     // this.add.text(32, 32 + 32 * index, `Part ${partNum}: ${label}`, textStyle)
        //     this.add.text(130, 150 + 70 * index, `Part ${partNum}: ${label}`, textStyle)
        //         .setInteractive()
        //         .setPadding(6)
        //         .on("pointerdown", () => {
        //             this.runScene(this.parts[partNum as keyof typeof this.parts][1]);
        //         });
        // }
    }

    update(): void {
        for (var i = 0; i < this.sprites.length; i++)
        {
            const sprite = this.sprites[i].s;
            sprite.x += config.lobby.speed*Math.cos(this.sprites[i].t);
            sprite.y += config.lobby.speed*Math.sin(this.sprites[i].t);

            const h = sprite.height/2
            const w = sprite.width/2

            if (sprite.y > h + config.game.height) {
                sprite.y = -h;
                sprite.x = Phaser.Math.Between(0, config.game.width);
            } else if (sprite.y < -h) {
                sprite.y = h + config.game.height;
                sprite.x = Phaser.Math.Between(0, config.game.width);
            } else if (sprite.x > w + config.game.width) {
                sprite.y = Phaser.Math.Between(0, config.game.height);
                sprite.x = -w;
            } else if (sprite.x < -w) {
                sprite.y = Phaser.Math.Between(0, config.game.height);
                sprite.x = w + config.game.width;
            }
        }
    }

    runScene(key: string) {
        this.scene.start(key);
        this.scene.stop("lobby");
    }
}