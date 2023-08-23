import { makeWebSocketApi } from "../core/makeWebSocketApi";
import { makeCustomType, makeEnum, Proto } from "../core/Proto";
import { EAchivment, EAnimate, EDir, EEffect, EExplodeDir, ESounds } from "./types";

export const POSITION = makeCustomType<number>(
  (db, value) => {
    db.writeint32(value * 1000);
  },
  (db) => {
    return db.readint32() / 1000;
  }
);

export const DIRECTION = makeEnum(EDir);
export const ANIMATION = makeEnum(EAnimate);
export const SOUND = makeEnum(ESounds);
export const EFFECT = makeEnum(EEffect);
export const ACHIVMENT = makeEnum(EAchivment);
export const EXPLODEDIRECTION = makeEnum(EExplodeDir);

export const INPUT_POSITION = new Proto({
  x: POSITION,
  y: POSITION,
  dir: DIRECTION,
  animate: ANIMATION,
});

export const MESSAGE_INFO = new Proto({
  message: 'string',
  sender: {
    name: 'string'
  },
  isMe: 'boolean'
});

export const EFFECT_INFO = new Proto({
  id: 'uint32',
  x: POSITION,
  y: POSITION,
  type: EFFECT,
  deltaTime: 'float64'
});

export const GAME_INFO = new Proto({
  width: 'uint8',
  height: 'uint8',
  winPlayerId: 'int8',
  playersCount: 'uint8',
  spectratorsCount: 'uint8',
});

export const PLAYER_POSITION = new Proto({
  id: 'uint32',
  x: POSITION,
  y: POSITION,
  dir: DIRECTION,
  animate: ANIMATION,
});

export const PLAYER_INFO = new Proto({
  id: 'uint32',
  name: 'string',
  color: 'uint8',
  inGame: 'boolean',
  isDeath: 'boolean',
  canJoin: 'boolean',
  wins: 'uint8',
  kills: 'uint8',
  deaths: 'uint8',
  effects: {
    haveShield: 'boolean',
    speed: 'float32',
  },
  ping: 'uint16'
});

export const ACHIVMENT_INFO = new Proto({
  id: 'uint32',
  x: POSITION,
  y: POSITION,
  type: ACHIVMENT
});

export const EXPLODE_INFO = new Proto({
  id: 'uint32',
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

export const START_POSITION = new Proto({
  x: POSITION,
  y: POSITION,
});

export const BOMB_INFO = new Proto({
  id: 'uint32',
  x: POSITION,
  y: POSITION,
  radius: 'uint16',
  isCrazy: 'boolean',
});

export const POSITION_SOUND = new Proto({
  position: {
    x: POSITION,
    y: POSITION
  },
  sound: SOUND
});

export const REMAINING_EFFECTS = new Proto({
  radius: 'int8',
  bombs: 'int8',
  speed: 'int8',
  shield: 'int8',
  crazy: 'int8',
})

export const gameApi = makeWebSocketApi({
  setPosition: { input: INPUT_POSITION },
  setBomb: {},
  setName: { input: 'string' },
  toGame: {},
  toLeave: {},
  sendMessage: { input: 'string' },
  randomColor: {},
  setSkin: { input: 'uint8' },
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
  updatePlayerPositions: { input: [PLAYER_POSITION] },
  updateGameInfo: { input: GAME_INFO },
  updateRemainingEffects: { input: REMAINING_EFFECTS },
  updateWaitForRestart: { input: 'int8' },
  updateEffects: { input: [EFFECT_INFO] },
  playSound: { input: SOUND },
  playSoundPosition: { input: POSITION_SOUND },
  onMessage: { input: MESSAGE_INFO },
  ping: {},
});

export const verifyApi = makeWebSocketApi({
  verify: { input: ['uint8'], output: 'int32' },
});