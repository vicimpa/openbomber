// Load test on the MAIN room: PLAYERS sdk clients in the arena + SPECTATORS watchers.
//   bun test/load.ts                              # 32 players + 50 spectators, 30 s
//   PLAYERS=12 SPECTATORS=0 SECONDS=20 bun test/load.ts
// Reports server sim tick time (avg / p99 / max), achieved tick rate, map size, bytes
// received per client per second (players vs spectators, incl. websocket framing) and
// the size of the initial full state for a late joiner.

import { Client, type Room } from '@colyseus/sdk';
import { matchMaker } from '@colyseus/core';
import { Button, MSG, TICK_RATE, packAxis } from '@ob/game';
import { limits, resetLimits } from '../src/limits.ts';
import { startGameServer } from '../src/app.ts';
import type { BattleRoom } from '../src/BattleRoom.ts';

const PLAYERS = Number(process.env.PLAYERS ?? 32);
const SPECTATORS = Number(process.env.SPECTATORS ?? 50);
const SECONDS = Number(process.env.SECONDS ?? 30);
const WARMUP = Number(process.env.WARMUP ?? 4);

Object.assign(limits, { clientsPerIp: 1e6, requestBurst: 1e6, requestsPerSecond: 1e6, createBurst: 1e6, createsPerSecond: 1e6 });
resetLimits();
const server = await startGameServer({ port: 0 });
const url = `ws://localhost:${server.port}`;
const players: Room[] = [];
const watchers: Room[] = [];
const bytes = new Map<Room, number>();

function instrument(room: Room) {
  bytes.set(room, 0);
  for (const t of [MSG.chat, MSG.events, MSG.ping, MSG.play]) room.onMessage(t, () => {});
  const ws = (room.connection.transport as unknown as { ws: WebSocket }).ws;
  ws.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as ArrayBuffer | string;
    bytes.set(room, bytes.get(room)! + (typeof d === 'string' ? d.length : d.byteLength));
  });
}

for (let i = 0; i < PLAYERS; i++) {
  const r = await new Client(url).joinById('MAIN', { name: `load${i}`, skin: i % 12, play: true });
  players.push(r);
  instrument(r);
}
for (let i = 0; i < SPECTATORS; i++) {
  const r = await new Client(url).joinById('MAIN', { name: `watch${i}`, skin: 0 });
  watchers.push(r);
  instrument(r);
}
const sr = matchMaker.getLocalRoomById('MAIN') as unknown as BattleRoom;

// random walkers: new direction every ~1 s, a bomb now and then
const seqs = players.map(() => 0);
const dirs = players.map(() => [0, 0]);
const timer = setInterval(() => {
  players.forEach((r, i) => {
    if (Math.random() < 1 / 30) {
      const a = Math.floor(Math.random() * 5);
      dirs[i] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]][a]!;
    }
    const b = Math.random() < 0.02 ? Button.Bomb : 0;
    const [dx, dy] = dirs[i]!;
    r.send(MSG.input, [
      [++seqs[i]!, packAxis(dx!), packAxis(dy!), b],
      [++seqs[i]!, packAxis(dx!), packAxis(dy!), 0],
    ]);
  });
}, 2000 / TICK_RATE);

await Bun.sleep(WARMUP * 1000);
for (const k of bytes.keys()) bytes.set(k, 0);
sr.resetTickStats();
const t0 = performance.now();
const phases = new Map<number, number>();
const sizes = new Set<string>();
const sampler = setInterval(() => {
  const w = sr.sim.state;
  phases.set(w.phase, (phases.get(w.phase) ?? 0) + 1);
  sizes.add(`${w.width}x${w.height}`);
}, 100);
await Bun.sleep(SECONDS * 1000);
const elapsed = (performance.now() - t0) / 1000;
clearInterval(sampler);

// full state size for a late joiner (first 300 ms after join)
const late = await new Client(url).joinById('MAIN', { name: 'late', skin: 0 });
instrument(late);
await Bun.sleep(300);
const lateBytes = bytes.get(late)!;
clearInterval(timer);

const st = sr.getTickStats();
const rate = (rs: Room[]) => {
  const v = rs.map((r) => bytes.get(r)! / elapsed);
  return v.length ? { avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length), max: Math.round(Math.max(...v)) } : null;
};
console.log(JSON.stringify({
  players: sr.humanCount, spectators: sr.clientCount - sr.humanCount, simPlayers: sr.sim.state.players.size,
  mapSizes: [...sizes], seconds: +elapsed.toFixed(1),
  tickMs: { avg: +st.avg.toFixed(3), p99: +st.p99.toFixed(3), max: +st.max.toFixed(3) },
  ticksPerSec: +(st.ticks / elapsed).toFixed(1),
  bytesPerSec: { player: rate(players), spectator: rate(watchers) },
  lateJoinFirst300msBytes: lateBytes,
  phaseSamples: Object.fromEntries(phases),
  rounds: sr.sim.state.round,
}, null, 2));

for (const r of [...players, ...watchers, late]) await Promise.race([r.leave(true), Bun.sleep(100)]);
await server.close();
process.exit(0);
