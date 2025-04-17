// Shared types for Flocker Experiment

export enum Emote {
  Exclaim = '!',
  Plus = '+',
  X = 'x',
  Question = '?',
  None = '',
}

export interface Player {
  id: string;
  name: string;
  color: string; // hex or hsl
  isInformed: boolean;
  x: number;
  y: number;
  emote: Emote;
  connected: boolean;
  lastActive: number; // timestamp
}

export interface Zone {
  id: 'north' | 'south' | 'east' | 'west';
  x: number;
  y: number;
  radius: number;
}

export interface GameState {
  players: Record<string, Player>;
  round: number;
  trial: number;
  zones: Zone[];
  correctZoneId: Zone['id'];
  trialStartTime: number;
  trialEndTime: number;
  lobby: boolean;
  instructionsShown: boolean;
}

export interface EmoteEvent {
  playerId: string;
  emote: Emote;
  timestamp: number;
}

export interface PositionEvent {
  playerId: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface ConnectionEvent {
  playerId: string;
  event: 'join' | 'leave' | 'reconnect';
  timestamp: number;
}

export interface TrialData {
  round: number;
  trial: number;
  positions: PositionEvent[];
  emotes: EmoteEvent[];
  connections: ConnectionEvent[];
  startTime: number;
  endTime: number;
}

export interface EndSurvey {
  playerId: string;
  code: string;
  strategy: string;
}

// Color palette for color-blind friendly assignment
export const COLOR_PALETTE: string[] = [
  '#E69F00', // orange
  '#56B4E9', // sky blue
  '#009E73', // bluish green
  '#F0E442', // yellow
  '#0072B2', // blue
  '#D55E00', // vermillion
  '#CC79A7', // reddish purple
  '#999999', // gray
  // Add more as needed
];
