// Colyseus GameRoom for Flocker experiment
import { Room, Client } from 'colyseus';
import { GameState, Player, Emote, COLOR_PALETTE, Zone, EmoteEvent, PositionEvent, ConnectionEvent, TrialData } from '../../shared/src/types';
import fs from 'fs';
import path from 'path';

function getRandomColor(usedColors: Set<string>): string {
  for (const color of COLOR_PALETTE) {
    if (!usedColors.has(color)) return color;
  }
  // fallback: random hue
  let hue = Math.floor(Math.random() * 360);
  return `hsl(${hue},70%,60%)`;
}

function getNow(): number {
  return Date.now();
}

export class GameRoom extends Room<GameState> {
  maxClients = 20;
  minClients = process.env.DEBUG_MODE === 'true' ? 1 : 10;
  usedColors = new Set<string>();
  emoteEvents: EmoteEvent[] = [];
  positionEvents: PositionEvent[] = [];
  connectionEvents: ConnectionEvent[] = [];
  trialData: TrialData[] = [];
  roundCount = 3;
  trialPerRound = 5;
  trialDuration = 90 * 1000; // ms
  instructionsDuration = 2 * 60 * 1000; // ms
  zones: Zone[] = [
    { id: 'north', x: 400, y: 100, radius: 80 },
    { id: 'south', x: 400, y: 500, radius: 80 },
    { id: 'east',  x: 700, y: 300, radius: 80 },
    { id: 'west',  x: 100, y: 300, radius: 80 },
  ];
  lobbyReady: Set<string> = new Set();
  experimentStarted = false;
  round = 1;
  trial = 1;
  correctZoneId: Zone['id'] = 'north';
  informedIds: Set<string> = new Set();
  reconnectTimeout = 120 * 1000; // ms (increased for easier reconnect)
  debugMode = process.env.DEBUG_MODE === 'true';

  onCreate() {
    console.log('[GameRoom] Room created. Debug mode:', this.debugMode);
    this.setState({
      players: {},
      round: 1,
      trial: 1,
      zones: this.zones,
      correctZoneId: 'north',
      trialStartTime: 0,
      trialEndTime: 0,
      lobby: true,
      instructionsShown: false,
    });

    this.onMessage('ready', (client) => {
      console.log(`[GameRoom] Player ready: ${client.sessionId}`);
      this.lobbyReady.add(client.sessionId);
      this.checkStartConditions();
    });

    this.onMessage('move', (client, { x, y }) => {
      console.log(`[GameRoom] Move from ${client.sessionId}: (${x}, ${y})`);
      const player = this.state.players[client.sessionId];
      if (!player) return;
      player.x = x;
      player.y = y;
      this.positionEvents.push({ playerId: client.sessionId, x, y, timestamp: getNow() });
    });

    this.onMessage('emote', (client, { emote }) => {
      console.log(`[GameRoom] Emote from ${client.sessionId}: ${emote}`);
      const player = this.state.players[client.sessionId];
      if (!player) return;
      player.emote = emote;
      this.emoteEvents.push({ playerId: client.sessionId, emote, timestamp: getNow() });
      setTimeout(() => {
        if (player.emote === emote) player.emote = Emote.None;
      }, 1000);
    });

    this.onMessage('survey', (client, { code, strategy }) => {
      console.log(`[GameRoom] Survey from ${client.sessionId}: code=${code}`);
      const survey = { playerId: client.sessionId, code, strategy };
      const dir = path.join(__dirname, '../../data');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, `${code}_survey.json`), JSON.stringify(survey, null, 2));
    });
  }

  onJoin(client: Client, options: any) {
    console.log(`[GameRoom] Player joined: ${client.sessionId}`);
    // Assign color and add player
    const color = getRandomColor(this.usedColors);
    this.usedColors.add(color);
    this.state.players[client.sessionId] = {
      id: client.sessionId,
      name: options.name || '',
      color,
      isInformed: false,
      x: 400,
      y: 300,
      emote: Emote.None,
      connected: true,
      lastActive: getNow(),
    };
    this.connectionEvents.push({ playerId: client.sessionId, event: 'join', timestamp: getNow() });
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`[GameRoom] Player left: ${client.sessionId}`);
    const player = this.state.players[client.sessionId];
    if (player) {
      player.connected = false;
      this.connectionEvents.push({ playerId: client.sessionId, event: 'leave', timestamp: getNow() });
      // Allow reconnection for a period
      setTimeout(() => {
        if (!this.state.players[client.sessionId]?.connected) {
          delete this.state.players[client.sessionId];
        }
      }, this.reconnectTimeout);
    }
  }

  onAuth(client: Client, options: any, request: any) {
    return true;
  }

  onDispose() {
    // Save all trial data
    const dir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    for (const trial of this.trialData) {
      const ts = new Date(trial.startTime).toISOString().replace(/[:T]/g, '-').slice(0, 16);
      const fname = `${ts}_Round-${trial.round}_Trial-${trial.trial}.json`;
      fs.writeFileSync(path.join(dir, fname), JSON.stringify(trial, null, 2));
    }
  }

  checkStartConditions() {
    if (this.experimentStarted) return;
    const readyCount = this.lobbyReady.size;
    const totalCount = Object.keys(this.state.players).length;
    console.log(`[GameRoom] Checking start: ${readyCount} ready / ${totalCount} total (min: ${this.minClients})`);
    if (readyCount >= this.minClients) {
      this.experimentStarted = true;
      this.state.lobby = false;
      this.startExperiment();
    }
  }

  async startExperiment() {
    console.log('[GameRoom] Experiment starting');
    for (let round = 1; round <= this.roundCount; round++) {
      this.state.round = round;
      this.state.instructionsShown = true;
      console.log(`[GameRoom] Round ${round} instructions shown`);
      await this.delay(this.instructionsDuration);
      this.state.instructionsShown = false;
      this.assignInformed(round);
      console.log(`[GameRoom] Round ${round} informed assigned`);
      for (let trial = 1; trial <= this.trialPerRound; trial++) {
        this.state.trial = trial;
        this.state.trialStartTime = getNow();
        this.state.trialEndTime = this.state.trialStartTime + this.trialDuration;
        this.correctZoneId = this.pickCorrectZone();
        this.state.correctZoneId = this.correctZoneId;
        this.emoteEvents = [];
        this.positionEvents = [];
        this.connectionEvents = [];
        console.log(`[GameRoom] Round ${round} Trial ${trial} started. Correct zone: ${this.correctZoneId}`);
        await this.delay(this.trialDuration);
        this.saveTrial(round, trial);
        console.log(`[GameRoom] Round ${round} Trial ${trial} ended.`);
      }
    }
    this.broadcast('end', {});
    console.log('[GameRoom] Experiment ended.');
  }

  assignInformed(round: number) {
    const allIds = Object.keys(this.state.players);
    let percent = round === 1 ? 0.1 : round === 2 ? 0.25 : 0.5;
    let n = Math.floor(allIds.length * percent);
    for (const id of allIds) {
      if (this.state.players[id].isInformed) n--;
    }
    const uninformed = allIds.filter(id => !this.state.players[id].isInformed);
    for (let i = 0; i < n && uninformed.length > 0; i++) {
      const idx = Math.floor(Math.random() * uninformed.length);
      const id = uninformed.splice(idx, 1)[0];
      this.state.players[id].isInformed = true;
      this.informedIds.add(id);
    }
  }

  pickCorrectZone(): Zone['id'] {
    const ids: Zone['id'][] = ['north', 'south', 'east', 'west'];
    return ids[Math.floor(Math.random() * ids.length)];
  }

  saveTrial(round: number, trial: number) {
    const data: TrialData = {
      round,
      trial,
      positions: this.positionEvents,
      emotes: this.emoteEvents,
      connections: this.connectionEvents,
      startTime: this.state.trialStartTime,
      endTime: getNow(),
    };
    this.trialData.push(data);
    const dir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const ts = new Date(data.startTime).toISOString().replace(/[:T]/g, '-').slice(0, 16);
    const fname = `${ts}_Round-${round}_Trial-${trial}.json`;
    fs.writeFileSync(path.join(dir, fname), JSON.stringify(data, null, 2));
    // Save connection report if any disconnects/rejoins
    if (data.connections.length > 0) {
      const connFname = `${ts}_Round-${round}_Trial-${trial}_connection-report.json`;
      fs.writeFileSync(path.join(dir, connFname), JSON.stringify(data.connections, null, 2));
    }
  }

  delay(ms: number) {
    return new Promise(res => setTimeout(res, ms));
  }
}
