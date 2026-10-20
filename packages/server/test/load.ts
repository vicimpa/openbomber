// Load test: one room, HUMANS sdk clients (+ bots) sending random inputs for SECONDS.
//   bun test/load.ts                 # 16 humans, 30 s
//   HUMANS=12 BOTS=15 bun test/load.ts   # 12 humans + 4 bots (bots option is a fill target)
// Reports server sim tick time (avg / p99 / max), achieved tick rate, and bytes received
// per client per second (= server outbound per client, incl. websocket framing).

import { Client, type Room } from '@colyseus/sdk';
import { matchMaker } from '@colyseus/core';
import { Button, MSG, ROOM_NAME, TICK_RATE, packAxis } from '@ob/game';
import { startGameServer } from '../src/app.ts';
import type { BattleRoom } from '../src/BattleRoom.ts';

const HUMANS = Number(process.env.HUMANS ?? 16);
const BOTS = Number(process.env.BOTS ?? 3);
const SECONDS = Number(process.env.SECONDS ?? 30);
const WARMUP = 3;

const server = await startGameServer({ port: 0 });
const url = `ws://localhost:${server.port}`;
const rooms: Room[] = [];
const bytes: number[] = [];

function instrument(room: Room, i: number) {
  bytes[i] = 0;
  for (const t of [MSG.chat, MSG.events, MSG.ping]) room.onMessage(t, () => {});
  const ws = (room.connection.transport as unknown as { ws: WebSocket }).ws;
  ws.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as ArrayBuffer | string;
    bytes[i]! += typeof d === 'string' ? d.length : d.byteLength;
  });
}

const first = await new Client(url).create(ROOM_NAME, { name: 'load0', skin: 0, bots: BOTS });
rooms.push(first);
instrument(first, 0);
for (let i = 1; i < HUMANS; i++) {
  const r = await new Client(url).joinById(first.roomId, { name: `load${i}`, skin: i % 11 });
  rooms.push(r);
  instrument(r, i);
}
const sr = matchMaker.getLocalRoomById(first.roomId) as unknown as BattleRoom;

// random walkers: new direction every ~1 s, a bomb now and then
const seqs = rooms.map(() => 0);
const dirs = rooms.map(() => [0, 0]);
const timer = setInterval(() => {
  rooms.forEach((r, i) => {
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
bytes.fill(0);
sr.resetTickStats();
const t0 = performance.now();
const phases = new Map<number, number>();
const sampler = setInterval(() => phases.set(sr.sim.state.phase, (phases.get(sr.sim.state.phase) ?? 0) + 1), 100);
await Bun.sleep(SECONDS * 1000);
const elapsed = (performance.now() - t0) / 1000;
clearInterval(sampler);
clearInterval(timer);

const st = sr.getTickStats();
const perClient = bytes.map((b) => b / elapsed);
const avgBps = perClient.reduce((a, b) => a + b, 0) / perClient.length;
console.log(JSON.stringify({
  humans: sr.humanCount, bots: sr.botCount, simPlayers: sr.sim.state.players.size,
  seconds: +elapsed.toFixed(1),
  tickMs: { avg: +st.avg.toFixed(3), p99: +st.p99.toFixed(3), max: +st.max.toFixed(3) },
  ticksPerSec: +(st.ticks / elapsed).toFixed(1),
  bytesPerClientPerSec: { avg: Math.round(avgBps), min: Math.round(Math.min(...perClient)), max: Math.round(Math.max(...perClient)) },
  phaseSamples: Object.fromEntries(phases),
  rounds: sr.sim.state.round,
}, null, 2));

for (const r of rooms) await Promise.race([r.leave(true), Bun.sleep(200)]);
await server.close();
process.exit(0);
