import { makeCustomType, Proto } from "./core/Proto";

const POSITION = makeCustomType<number>(
  (db, value) => {
    db.writeint16(value * 1000);
  },
  (db) => {
    return db.readint16() / 1000;
  }
);

export const PlayerPositionsProto = new Proto([{
  id: 'uint16',
  x: 'float32',
  y: 'float32',
  dir: 'uint8',
  animate: 'uint8',
}]);

export const PlayerInfosProto = new Proto([{
  id: 'uint16',
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
}]);

export const PlayerSetPositionProto = new Proto({
  x: POSITION,
  y: POSITION,
  dir: 'uint8',
  animate: 'uint8'
});

export const BombsStateProto = new Proto([{
  x: 'float32',
  y: 'float32',
  radius: 'uint8',
  isCrazy: 'boolean'
}]);

export const ExplodesStateProto = new Proto([{
  x: 'float32',
  y: 'float32',
  points: [{
    x: 'float32',
    y: 'float32',
    dir: 'uint8',
    isFinaly: 'boolean',
    isBlock: 'boolean',
  }]
}]);