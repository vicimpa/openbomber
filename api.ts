import { makeWebSocketApi } from "./core/makeWebSocketApi";
import { makeCustomType, makeEnum, Proto } from "./core/Proto";
import { EAchivment, EAnimate, EDir, EEffect, EExplodeDir, ESounds } from "./types";


const POSITION = makeCustomType<number>(
  (db, value) => {
    db.writeint32(value * 1000);
  },
  (db) => {
    return db.readint32() / 1000;
  }
);

const DIRECTION = makeEnum(EDir);
const ANIMATION = makeEnum(EAnimate);
const SOUND = makeEnum(ESounds);
const EFFECT = makeEnum(EEffect);
const ACHIVMENT = makeEnum(EAchivment);
const EXPLODEDIRECTION = makeEnum(EExplodeDir);

const INPUT_POSITION = new Proto({
  x: POSITION,
  y: POSITION,
  dir: DIRECTION,
  animate: ANIMATION,
});

const MESSAGE_INFO = new Proto({
  message: 'string',
  sender: {
    name: 'string'
  },
  isMe: 'boolean'
});

const EFFECT_INFO = new Proto({
  x: POSITION,
  y: POSITION,
  type: EFFECT,
  deltaTime: 'float64'
});

const GAME_INFO = new Proto({
  width: 'uint8',
  height: 'uint8',
  winPlayerId: 'int8',
  playersCount: 'uint8',
  spectratorsCount: 'uint8',
});

const PLAYER_POSITION_INFO = new Proto({
  id: 'uint8',
  x: 'float32',
  y: 'float32',
  dir: 'uint8',
  animate: 'uint8',
});

const PLAYER_INFO = new Proto({
  id: 'uint8',
  name: 'string',
  color: 'uint8',
  inGame: 'boolean',
  isDeath: 'boolean',
  canJoin: 'boolean',
  wins: 'uint8',
  kills: 'uint8',
  deaths: 'uint8',
  effects: {
    bombs: 'uint8',
    radius: 'uint8',
    haveShield: 'boolean',
    speed: 'float32',
    crazyBomb: 'boolean',
  },
  ping: 'uint16'
});

const ACHIVMENT_INFO = new Proto({
  x: POSITION,
  y: POSITION,
  type: ACHIVMENT
});

const EXPLODE_INFO = new Proto({
  x: POSITION,
  y: POSITION,
  points: [{
    x: POSITION,
    y: POSITION,
    dir: EXPLODEDIRECTION,
    isFinaly: 'boolean',
    isBlock: 'boolean',
  }]
});

const START_POSITION = new Proto({
  x: POSITION,
  y: POSITION,
});

const BOMB_INFO = new Proto({
  x: POSITION,
  y: POSITION,
  radius: 'uint16',
  isCrazy: 'boolean',
});

export const gameApi = makeWebSocketApi({
  setPosition: { input: INPUT_POSITION },
  setBomb: {},
  setName: { input: 'string' },
  toGame: {},
  toLeave: {},
  sendMessage: { input: 'string' },
  randomColor: {},
  ping: {},
});

export const playerApi = makeWebSocketApi({
  setStartPosition: { input: START_POSITION },
  updateMap: { input: ['int8'] },
  updateBombs: { input: [BOMB_INFO] },
  updatePlayers: { input: [PLAYER_INFO] },
  updateExplodes: { input: [EXPLODE_INFO] },
  updateAchivments: { input: [ACHIVMENT_INFO] },
  updateLocalInfo: { input: PLAYER_INFO },
  updatePlayerPositions: { input: [PLAYER_POSITION_INFO] },
  updateGameInfo: { input: GAME_INFO },
  updateWaitForRestart: { input: 'int8' },
  updateEffects: { input: [EFFECT_INFO] },
  playSound: { input: SOUND },
  onMessage: { input: MESSAGE_INFO },
  ping: {},
});