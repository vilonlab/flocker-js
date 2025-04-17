import Phaser from 'phaser';
// For types
import type { Client as ColyseusClientType, Room as RoomType } from 'colyseus.js';
// For runtime
// @ts-ignore
import ColyseusJs from 'colyseus.js';
const { Client: ColyseusClient, Room } = ColyseusJs;
import { GameState, Emote } from '../../shared/src/types';

const SERVER_URL = 'ws://localhost:2567';

class LobbyScene extends Phaser.Scene {
  colyseusClient: ColyseusClientType;
  room: RoomType<GameState> | null = null;
  readyButton!: Phaser.GameObjects.Text;
  infoText!: Phaser.GameObjects.Text;
  lobbyCountdown!: Phaser.GameObjects.Text;
  readyCountText!: Phaser.GameObjects.Text;
  lobbyTimer: number = 0;
  lobbyInterval: any;
  latestState: GameState | null = null;

  constructor() {
    super('LobbyScene');
    this.colyseusClient = new ColyseusClient(SERVER_URL);
  }

  preload() {}

  create() {
    console.log('[Client] LobbyScene created');
    this.infoText = this.add.text(400, 200, 'Waiting for players...\nClick READY to join.', { fontSize: '24px', color: '#222' }).setOrigin(0.5);
    this.readyButton = this.add.text(400, 350, 'READY', { fontSize: '32px', color: '#fff', backgroundColor: '#0072B2', padding: { x: 20, y: 10 } })
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => this.joinRoom());
    this.lobbyCountdown = this.add.text(400, 420, '', { fontSize: '20px', color: '#444' }).setOrigin(0.5);
    this.readyCountText = this.add.text(400, 470, '', { fontSize: '20px', color: '#444' }).setOrigin(0.5);
    this.lobbyTimer = 0;
    this.lobbyInterval = setInterval(() => this.updateLobbyInfo(), 500);
  }

  async joinRoom() {
    this.readyButton.setVisible(false);
    this.infoText.setText('Connecting...');
    try {
      this.room = await this.colyseusClient.joinOrCreate<GameState>('flocker', {});
      console.log('[Client] Joined Colyseus room', this.room.sessionId);
      this.room.send('ready');
      this.room.onStateChange((state: GameState) => {
        this.latestState = state;
        this.updateLobbyInfo();
      });
      this.scene.start('GameScene', { room: this.room });
    } catch (e) {
      this.infoText.setText('Failed to connect. Try again.');
      this.readyButton.setVisible(true);
      console.error('[Client] Failed to join room', e);
    }
  }

  updateLobbyInfo() {
    if (!this.room || !this.latestState) return;
    const state = this.latestState;
    const ready = Object.keys(state.players).filter(id => this.room!.state.players[id] && this.room!.state.players[id].connected && this.room!.state.players[id].id && this.room!.state.players[id].id.length > 0 && this.room!.state.players[id].id === id && this.room!.state.players[id].connected && this.room!.state.players[id].lastActive).length;
    const total = Object.keys(state.players).length;
    this.readyCountText.setText(`${ready} / ${total} Players Ready`);
    // Optionally, show a countdown if you want to auto-start after a timer
    // this.lobbyCountdown.setText('Lobby open...');
  }
}

class GameScene extends Phaser.Scene {
  room!: RoomType<GameState>;
  playerId: string = '';
  state: GameState | null = null;
  zoneGraphics: Record<string, Phaser.GameObjects.Graphics> = {};
  playerDots: Record<string, Phaser.GameObjects.Container> = {};
  timerText!: Phaser.GameObjects.Text;
  roundText!: Phaser.GameObjects.Text;
  instructionsBox!: Phaser.GameObjects.Text;
  endBox!: Phaser.GameObjects.Text;
  inputEnabled: boolean = false;
  emoteKeys: Record<string, Emote> = { '1': Emote.Exclaim, '2': Emote.Plus, '3': Emote.X, '4': Emote.Question };
  zoneLabels: Record<string, Phaser.GameObjects.Text> = {};

  constructor() {
    super('GameScene');
  }

  init(data: { room: RoomType<GameState> }) {
    this.room = data.room;
    this.playerId = this.room.sessionId;
  }

  preload() {}

  create() {
    console.log('[Client] GameScene created');
    this.cameras.main.setBackgroundColor('#f4f4f4');
    this.timerText = this.add.text(20, 20, '', { fontSize: '24px', color: '#222' }).setOrigin(0, 0);
    this.roundText = this.add.text(780, 20, '', { fontSize: '24px', color: '#222' }).setOrigin(1, 0);
    this.instructionsBox = this.add.text(400, 100, '', { fontSize: '20px', color: '#222', backgroundColor: '#fff', padding: { x: 20, y: 20 }, wordWrap: { width: 600 } }).setOrigin(0.5).setVisible(false);
    this.endBox = this.add.text(400, 300, '', { fontSize: '24px', color: '#222', backgroundColor: '#fff', padding: { x: 20, y: 20 }, wordWrap: { width: 600 } }).setOrigin(0.5).setVisible(false);
    // Draw static zone labels
    const zoneNames = { north: 'N', south: 'S', east: 'E', west: 'W' };
    for (const id of Object.keys(zoneNames) as Array<keyof typeof zoneNames>) {
      this.zoneLabels[id] = this.add.text(0, 0, zoneNames[id], { fontSize: '32px', color: '#222', fontStyle: 'bold' }).setOrigin(0.5);
      this.zoneLabels[id].setDepth(2);
    }
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.inputEnabled) return;
      console.log('[Client] Pointer down at', pointer.x, pointer.y);
      this.room.send('move', { x: pointer.x, y: pointer.y });
    });
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (!this.inputEnabled) return;
      const emote = this.emoteKeys[event.key];
      if (emote) {
        console.log('[Client] Emote key pressed:', event.key, emote);
        this.room.send('emote', { emote });
      }
    });
    this.room.onStateChange((state: GameState) => {
      console.log('[Client] State changed', state);
      this.syncState(state);
    });
    this.room.onMessage('end', () => {
      console.log('[Client] Experiment ended');
      this.showEndScreen();
    });
  }

  syncState(state: GameState) {
    this.state = state;
    // Debug: log all zone and player coordinates
    console.log('[DEBUG] Zones:', state.zones.map(z => ({ id: z.id, x: z.x, y: z.y, radius: z.radius })));
    console.log('[DEBUG] Players:', Object.values(state.players).map(p => ({ id: p.id, x: p.x, y: p.y, color: p.color, emote: p.emote })));
    // Draw zones (force always visible for debugging)
    for (const zone of state.zones) {
      if (!this.zoneGraphics[zone.id]) {
        const g = this.add.graphics();
        g.setDepth(1);
        this.zoneGraphics[zone.id] = g;
      }
      const g = this.zoneGraphics[zone.id];
      g.clear();
      g.fillStyle(0x888888, 1);
      g.fillCircle(zone.x, zone.y, zone.radius);
      // Draw border for correct zone if informed
      const me = state.players[this.playerId];
      if (me?.isInformed && state.correctZoneId === zone.id && !state.lobby && !state.instructionsShown) {
        g.lineStyle(8, 0xff2222, 1);
        g.strokeCircle(zone.x, zone.y, zone.radius + 4);
      } else {
        g.lineStyle(2, 0x444444, 1);
        g.strokeCircle(zone.x, zone.y, zone.radius);
      }
      if (this.zoneLabels[zone.id]) {
        this.zoneLabels[zone.id].setPosition(zone.x, zone.y);
        this.zoneLabels[zone.id].setVisible(true);
      }
    }
    // Hide unused zone graphics/labels if zones are missing
    for (const id of Object.keys(this.zoneGraphics)) {
      if (!state.zones.find(z => z.id === id)) {
        this.zoneGraphics[id].clear();
        if (this.zoneLabels[id]) this.zoneLabels[id].setVisible(false);
      }
    }
    // Draw players (force always visible for debugging)
    for (const id in state.players) {
      const p = state.players[id];
      if (!this.playerDots[id]) {
        const c = this.add.container(p.x, p.y);
        const dot = this.add.circle(0, 0, 24, Phaser.Display.Color.HexStringToColor(p.color).color);
        const emote = this.add.text(0, 0, '', { fontSize: '20px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        c.add([dot, emote]);
        this.playerDots[id] = c;
      }
      const c = this.playerDots[id];
      c.setPosition(p.x, p.y);
      (c.list[0] as Phaser.GameObjects.Arc).setFillStyle(Phaser.Display.Color.HexStringToColor(p.color).color);
      const emoteText = p.emote !== Emote.None ? p.emote : '';
      (c.list[1] as Phaser.GameObjects.Text).setText(emoteText);
      (c.list[1] as Phaser.GameObjects.Text).setColor(this.getContrastColor(p.color));
      c.setAlpha(p.connected ? 1 : 0.3);
      c.setVisible(true);
    }
    for (const id in this.playerDots) {
      if (!state.players[id]) {
        this.playerDots[id].destroy();
        delete this.playerDots[id];
      }
    }
    // UI overlays (do not hide zones/players for debugging)
    if (state.lobby) {
      this.timerText.setText('Waiting for players...');
      this.roundText.setText('');
      this.inputEnabled = false;
    } else if (state.instructionsShown) {
      this.showInstructions(state.players[this.playerId]?.isInformed);
      this.inputEnabled = false;
      const t = Math.max(0, Math.floor((state.trialStartTime + 2 * 60 * 1000 - Date.now()) / 1000));
      this.timerText.setText(`Instructions: ${t}s`);
      this.roundText.setText(`Round: ${state.round}`);
    } else {
      this.instructionsBox.setVisible(false);
      this.inputEnabled = true;
      const t = Math.max(0, Math.floor((state.trialEndTime - Date.now()) / 1000));
      this.timerText.setText(`Time: ${t}s`);
      this.roundText.setText(`Round: ${state.round}  Trial: ${state.trial}`);
    }
  }

  showInstructions(isInformed: boolean) {
    this.instructionsBox.setVisible(true);
    this.instructionsBox.setText(isInformed ?
      'Welcome to the experiment!\n\nYou are an INFORMED player.\n\nYour role: Help guide the group to stand in the correct zone at the end of each trial.\n\n- Move your dot by clicking.\n- Emote: 1 = !, 2 = +, 3 = x, 4 = ?\n- The correct zone will have a red border.\n- 5 trials per round, 3 rounds.\n- Each trial: 90s.\n\nLead and coordinate to maximize group points.' :
      'Welcome to the experiment!\n\nYou are an UNINFORMED player.\n\nYour goal: Work with others to generate as many points as possible.\n\n- Move your dot by clicking.\n- Emote: 1 = !, 2 = +, 3 = x, 4 = ?\n- 5 trials per round, 3 rounds.\n- Each trial: 90s.\n\nCollaborate to find the correct zone and maximize your group’s score.'
    );
  }

  showEndScreen() {
    this.inputEnabled = false;
    this.endBox.setVisible(true);
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    this.endBox.setText(`Experiment complete!\n\nYour code: ${code}\n\nPlease take a picture of this code for credit.\n\nWhat strategy did you use?\n(Type below and press Enter)`);
    const input = this.add.dom(400, 400, 'input', 'width: 400px; font-size: 18px;');
    input.node.setAttribute('maxlength', '200');
    input.node.setAttribute('placeholder', 'Describe your strategy...');
    input.addListener('keyup');
    input.on('keyup', (event: any) => {
      if (event.key === 'Enter') {
        const strategy = (input.node as HTMLInputElement).value;
        this.room.send('survey', { code, strategy });
        input.destroy();
        this.endBox.setText(`Thank you!\n\nYour code: ${code}\n\nYou may now close this window.`);
      }
    });
  }

  getContrastColor(hex: string) {
    // Simple luminance check for white/black text
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const rgb = [0, 1, 2].map(i => parseInt(c.substr(i * 2, 2), 16));
    const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    return lum > 186 ? '#222' : '#fff';
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#f4f4f4',
  scene: [LobbyScene, GameScene],
};

window.addEventListener('load', () => {
  new Phaser.Game(config);
});
