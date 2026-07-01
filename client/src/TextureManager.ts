import Phaser from 'phaser';

export class TextureManager {
    private scene: Phaser.Scene;
    private pack?: string;
    // private textures: [string];

    constructor(scene: Phaser.Scene, pack_key?: string) {
        this.scene = scene;
        this.pack = pack_key;
    }

    public hasPack(): boolean {
        return this.pack !== undefined;
    }

    public setPack(pack: string): string {
        this.pack = pack;
        return pack;
    }

    public getPack(): string {
        if (this.pack) {
            return this.pack;
        } else {
            console.error('No pack specified, using default');
            this.setPack('default');
            return 'default';
        }
    }

    public preload(): void {

        const base_url = `./assets/packs/${this.getPack()}/`;
        const assets = {
            'player': base_url + 'player.png',
            'player-color': base_url + 'player-color.png',
            'background': base_url + 'background.png',
            'zone': base_url + 'zone.png',
            'zone-center': base_url + 'zone-center.png',
            'instruction': base_url + 'instruction.png',
        }

        Object.entries(assets).forEach(([key, value]) => {
            // const assetPath = new URL(value, import.meta.url);
            console.log(`Loading asset ${key} from ${value}`);
            this.scene.load.image(key, value);
        });
    }
}