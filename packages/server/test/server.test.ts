// End-to-end tests: a real server on a random port + real @colyseus/sdk clients,
// plus the browser NetSource (prediction / interpolation) driven from Bun.
//
// Uses the real Simulation from @ob/game when it is exported, else the stub in
// ./stubSim.ts. Force the stub with OB_STUB_SIM=1.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Client, type Room } from '@colyseus/sdk';
import { matchMaker } from '@colyseus/core';
import * as Game from '@ob/game';
import { BOMB_FUSE, Button, MSG, ROOM_NAME, TICK_MS, type ChatMessage, type GameEvent, type PredictMovement } from '@ob/game';
import { limits, resetLimits } from '../src/limits.ts';
import { startGameServer, type GameServer } from '../src/app.ts';
import { BattleRoom, MAIN_SPARRING } from '../src/BattleRoom.ts';
import { setGameImpl } from '../src/game.ts';
import { CODE_ALPHABET } from '../src/util.ts';
import { BattleState, type RoomListing } from '../src/schema.ts';
import { syncWorld } from '../src/sync.ts';
import { stubGame, stubMove } from './stubSim.ts';
import { connectQuickPlay, createPrivateRoom, joinRoomByCode, listRooms, type NetSource } from '../../client/src/net/index.ts';

const G = Game as unknown as Record<string, unknown>;
const useStub = process.env.OB_STUB_SIM === '1' || typeof G.Simulation !== 'function';
if (useStub) setGameImpl(stubGame);
const predict = (useStub ? stubMove : G.predictMovement) as PredictMovement;
console.log(`[test] simulation: ${useStub ? 'STUB' : 'real @ob/game'}`);

let server: GameServer;
let url: string;
const opened: { leave(c?: boolean): Promise<unknown> }[] = [];
const sources: NetSource[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor<T>(fn: () => T | undefined | null | false, ms = 4000, what = 'condition'): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timeout waiting for ${what}`);
    await sleep(10);
  }
}
const serverRoom = (id: string) => matchMaker.getLocalRoomById(id) as unknown as BattleRoom;
const track = <R extends { leave(c?: boolean): Promise<unknown> }>(r: R) => (opened.push(r), r);

async function join(method: 'joinOrCreate' | 'create' | 'joinById', arg: string, opts: object) {
  const c = new Client(url);
  const room = (await (c[method] as (a: string, o: object) => Promise<Room<any, BattleState>>)(arg, opts));
  for (const t of [MSG.chat, MSG.events, MSG.ping]) room.onMessage(t, () => {});
  return track(room);
}

let seq = 1000;
function sendFrames(room: Room, n: number, dx: number, dy: number, buttons = 0) {
  const frames = [];
  for (let i = 0; i < n; i++) frames.push([++seq, Math.round(dx * 127), Math.round(dy * 127), buttons]);
  room.send(MSG.input, frames);
}
/** Feed inputs in real time (2 frames / 2 ticks) for `ms`. */
async function hold(room: Room, ms: number, dx: number, dy: number, buttons = 0) {
  const end = Date.now() + ms;
  while (Date.now() < end) { sendFrames(room, 2, dx, dy, buttons); await sleep(TICK_MS * 2); }
}

// every test client connects from 127.0.0.1: lift the per-IP limits (tested separately below)
const STRICT = { ...limits };
const relax = () => Object.assign(limits, { clientsPerIp: 1e6, requestBurst: 1e6, requestsPerSecond: 1e6, createBurst: 1e6, createsPerSecond: 1e6 });

beforeAll(async () => {
  relax();
  resetLimits();
  server = await startGameServer({ port: 0, basePath: '/api' });
  url = `ws://localhost:${server.port}`;
});

afterAll(async () => {
  for (const s of sources) s.dispose();
  // leave() on an already-closed room never settles: only leave open ones, bounded.
  const open = opened.filter((r) => (r as unknown as Room).connection?.isOpen);
  await Promise.race([Promise.allSettled(open.map((r) => r.leave(true))), sleep(1000)]);
  await server.close();
}, 20000);

describe('http', () => {
  test('health at root and under /api', async () => {
    for (const p of ['/health', '/api/health']) {
      const r = await fetch(`http://localhost:${server.port}${p}`, { headers: { Origin: 'http://localhost:8080' } });
      expect(r.status).toBe(200);
      expect(((await r.json()) as { ok: boolean }).ok).toBe(true);
      expect(r.headers.get('access-control-allow-origin')).toBe('http://localhost:8080');
    }
  });
});

const chatsOf = (r: Room) => {
  const got: ChatMessage[] = [];
  r.onMessage(MSG.chat, (m: ChatMessage) => got.push(m));
  return got;
};
/** Phase in which a player can move (stub has no phases). */
const movablePhase = (sr: BattleRoom) => (useStub ? true : sr.sim.state.phase === 2 || sr.sim.state.phase === 3);

describe('room', () => {
  let a: Room<any, BattleState>;

  test('join as player: sanitised profile, state arrives', async () => {
    a = await join('create', ROOM_NAME, { private: true, name: '  Al\u0000ice‮  ', skin: 999, bots: 0, play: true });
    expect(a.roomId).toMatch(new RegExp(`^[${CODE_ALPHABET}]{5}$`));
    const me = await waitFor(() => a.state.width > 0 && a.state.players?.get(a.sessionId), 2000, 'state');
    expect(me.name).toBe('Alice');
    expect(me.skin).toBe(10);
    expect(a.state.tiles.length).toBe(a.state.width * a.state.height);
    expect(a.state.maxPlayers).toBe(32);
    expect(me.effects.size).toBeGreaterThanOrEqual(15); // generic TimedEffects map
  });

  test('inputs move the player authoritatively', async () => {
    const sr = serverRoom(a.roomId);
    await waitFor(() => movablePhase(sr), 4000, 'playing phase');
    const p0 = sr.sim.state.players.get(a.sessionId)!;
    const startX = p0.x, startY = p0.y;
    const dx = startX < sr.sim.state.width / 2 ? 1 : -1;
    await hold(a, 600, dx, 0);
    const p = sr.sim.state.players.get(a.sessionId)!;
    expect(Math.abs(p.x - startX)).toBeGreaterThan(0.5);
    expect(Math.abs(p.y - startY)).toBeLessThan(0.3);
    await waitFor(() => sr.sim.state.players.get(a.sessionId)!.ackSeq === seq, 500, 'ack');
    await waitFor(() => Math.abs(a.state.players.get(a.sessionId)!.x - p.x) < 1e-3, 1000, 'patched x');
    // invalid / replayed frames are ignored
    a.send(MSG.input, [[1, 127, 0, 0], ['x', 1, 1, 1], null, { seq: 'NaN' }]);
    await sleep(100);
    expect(sr.sim.state.players.get(a.sessionId)!.ackSeq).toBe(seq);
  });

  test('bomb placed by input appears and explodes with events', async () => {
    const events: GameEvent[] = [];
    a.onMessage(MSG.events, (e: GameEvent[]) => events.push(...e));
    let sawBomb = false;
    a.onStateChange((s) => { if (s.bombs.size > 0) sawBomb = true; });
    sendFrames(a, 1, 0, 0, Button.Bomb);
    sendFrames(a, 1, 0, 0, 0);
    const placed = await waitFor(() => events.find((e) => e.type === 'bombPlaced' && e.owner === a.sessionId), 1000, 'bombPlaced');
    expect(sawBomb || a.state.bombs.size > 0).toBe(true);
    const bombId = (placed as Extract<GameEvent, { type: 'bombPlaced' }>).bomb;
    await waitFor(() => events.find((e) => e.type === 'explosion' && e.bomb === bombId), (BOMB_FUSE * TICK_MS) + 1500, 'explosion');
    await waitFor(() => !a.state.bombs.has(String(bombId)), 500, 'bomb removed');
  });

  test('spectator first; play true/false; canon system chat', async () => {
    const sr = serverRoom(a.roomId);
    const seen = chatsOf(a);
    const b = await join('joinById', a.roomId, { name: 'Bob', skin: 1 });
    await waitFor(() => b.state.spectators === 1, 1000, 'spectator count');
    expect(sr.sim.state.players.has(b.sessionId)).toBe(false);
    const replies: { playing: boolean }[] = [];
    b.onMessage(MSG.play, (r: { playing: boolean }) => replies.push(r));
    b.send(MSG.play, true);
    await waitFor(() => replies.length === 1, 1000, 'play reply');
    expect(replies[0]!.playing).toBe(true);
    expect(sr.sim.state.players.has(b.sessionId)).toBe(true);
    await waitFor(() => seen.find((m) => m.from === '' && m.text === 'Bob подключился'), 1000, 'подключился');
    await waitFor(() => b.state.spectators === 0, 1000, 'no spectators');
    // inputs from spectators are ignored, from players accepted
    b.send(MSG.play, false);
    await waitFor(() => replies.length === 2, 1000, 'unplay reply');
    expect(sr.sim.state.players.has(b.sessionId)).toBe(false);
    await waitFor(() => seen.find((m) => m.text === 'Bob отключился'), 1000, 'отключился');
    await b.leave(true);
  });

  test('chat: sanitised, rate limited', async () => {
    const b = await join('joinById', a.roomId, { name: 'Bob', skin: 1 });
    const got = chatsOf(b);
    await sleep(50);
    b.send(MSG.chat, 'hi\u0007 there' + 'x'.repeat(200));
    b.send(MSG.chat, 'spam');
    await waitFor(() => got.find((m) => m.from === b.sessionId), 1000, 'chat');
    await sleep(150);
    const mine = got.filter((m) => m.from === b.sessionId);
    expect(mine.length).toBe(1);
    expect(mine[0]!.text.startsWith('hi there')).toBe(true);
    expect(mine[0]!.text.length).toBe(100);
    await b.leave(true);
    await waitFor(() => serverRoom(a.roomId).clientCount === 1, 1000, 'b left');
  });

  test('ping echo', async () => {
    const t = 12345.5;
    const echo = new Promise<{ t: number }>((r) => a.onMessage(MSG.ping, r));
    a.send(MSG.ping, t);
    expect((await echo).t).toBe(t);
  });
});

describe('matchmaking', () => {
  test('main room: persistent, listed; empty without players, a sparring bot for a lone one', async () => {
    const list = (await (await fetch(`http://localhost:${server.port}/api/rooms`)).json()) as RoomListing[];
    const main = list.find((r) => r.roomId === 'MAIN');
    expect(main?.metadata?.main).toBe(true);
    expect(main?.maxClients).toBe(200);
    const sr = serverRoom('MAIN');
    await waitFor(() => sr.botCount === 0, 15000, 'empty arena without bots');
    const s1 = await join('joinById', 'MAIN', { name: 'Watcher', skin: 0 });
    await waitFor(() => s1.state.width > 0, 1000, 'state');
    await sleep(1200);
    expect(sr.botCount).toBe(0); // only watching: the arena stays empty
    const p1 = await join('joinById', 'MAIN', { name: 'Lone', skin: 0, play: true });
    await waitFor(() => sr.sim.state.players.has(p1.sessionId), 1000, 'lone player');
    await waitFor(() => sr.botCount === MAIN_SPARRING, 1000, 'a sparring bot for the lone player');
    const p2 = await join('joinById', 'MAIN', { name: 'Second', skin: 0, play: true });
    await waitFor(() => sr.sim.state.players.has(p2.sessionId), 1000, 'second player');
    // the bot finishes the round it is in, then leaves
    const live = [...sr.sim.state.players.values()].some((p) => p.isBot && p.alive && p.inRound);
    if (live && sr.sim.state.phase !== Game.Phase.RoundOver) expect(sr.botCount).toBe(MAIN_SPARRING);
    await waitFor(() => sr.botCount === 0, 60_000, 'the bot leaves after the round');
    await Promise.all([s1.leave(), p1.leave(), p2.leave()]);
    await sleep(100);
    expect(matchMaker.getLocalRoomById('MAIN')).toBeTruthy(); // autoDispose = false
  });

  test('arena capacity: extra clients stay spectators ("Нет свободных мест")', async () => {
    const h = await join('create', ROOM_NAME, { private: true, name: 'H', skin: 0, bots: 0, maxPlayers: 2, play: true });
    const g = await join('joinById', h.roomId, { name: 'G', skin: 0, play: true });
    const x = await join('joinById', h.roomId, { name: 'X', skin: 0 });
    const said = chatsOf(x);
    const replies: { playing: boolean; reason?: string }[] = [];
    x.onMessage(MSG.play, (r: { playing: boolean; reason?: string }) => replies.push(r));
    x.send(MSG.play, true);
    await waitFor(() => replies.length === 1, 1000, 'reply');
    expect(replies[0]).toEqual({ playing: false, reason: 'full' });
    await waitFor(() => said.find((m) => m.from === '' && m.text === 'Нет свободных мест'), 1000, 'whisper');
    expect(serverRoom(h.roomId).sim.state.players.size).toBe(2);
    await Promise.all([h.leave(), g.leave(), x.leave()]);
  });

  test('private room: joinable by code, not listed, quick play goes to MAIN', async () => {
    const host = await join('create', ROOM_NAME, { private: true, name: 'Host', skin: 2, bots: 0, play: true });
    const code = host.roomId;
    const list = (await (await fetch(`http://localhost:${server.port}/api/rooms`)).json()) as RoomListing[];
    expect(list.some((r) => r.roomId === code)).toBe(false);
    const guest = await join('joinById', code.toLowerCase().toUpperCase(), { name: 'Guest', skin: 3, play: true });
    expect(guest.roomId).toBe(code);
    await waitFor(() => guest.state.players?.size === 2, 1000, 'two players');
    const quick = await join('joinOrCreate', ROOM_NAME, { name: 'Quick', skin: 0 });
    expect(quick.roomId).toBe('MAIN');
    await Promise.all([host.leave(), guest.leave(), quick.leave()]);
  });

  test('own room: the host sets bots, difficulty, capacity, zone and rain; others cannot', async () => {
    const host = await join('create', ROOM_NAME, { private: true, name: 'Host', skin: 0, play: true });
    const sr = serverRoom(host.roomId);
    await waitFor(() => host.state.ownerId === host.sessionId, 1000, 'owner');
    expect(sr.botCount).toBe(0); // own rooms start without bots
    await waitFor(() => sr.sim.state.round >= 1, 1000, 'first round');
    const round0 = sr.sim.state.round;
    const said = chatsOf(host);
    host.send(MSG.settings, { bots: 3, botDifficulty: 'hard', maxPlayers: 6, zone: false, events: false });
    await waitFor(() => host.state.bots === 3 && host.state.botDifficulty === 2 && host.state.maxPlayers === 6
      && host.state.zone === false && host.state.events === false, 1000, 'settings in state');
    await waitFor(() => said.find((m) => m.from === '' && m.text.startsWith('Настройки комнаты')), 1000, 'announced');
    // a bot-count change restarts the round, so the bots play right away (not a round later)
    await waitFor(() => sr.botCount === 3, 3000, '3 bots');
    await waitFor(() => sr.sim.state.round > round0
      && [...sr.sim.state.players.values()].filter((p) => p.isBot && p.inRound).length === 3, 3000, 'bots in a fresh round');
    await waitFor(() => said.find((m) => m.from === '' && m.text === 'Состав ботов изменён: новый раунд'), 1000, 'restart announced');

    const guest = await join('joinById', host.roomId, { name: 'Guest', skin: 0, play: true });
    guest.send(MSG.settings, { bots: 0 });
    await sleep(200);
    expect(sr.botCount).toBe(3); // not the host: ignored, and bots are an exact count
    expect(sr.sim.state.players.size).toBe(5);

    const gsaid = chatsOf(guest);
    await host.leave();
    await waitFor(() => guest.state.ownerId === guest.sessionId, 2000, 'host handed over');
    await waitFor(() => gsaid.find((m) => m.from === '' && m.text === 'Guest теперь управляет комнатой'), 1000, 'handover chat');
    guest.send(MSG.settings, { bots: 1 });
    await waitFor(() => guest.state.bots === 1, 1000, 'new host can change settings');
    await waitFor(() => sr.botCount === 1, 3000, 'live bots removed for the new roster');
    await guest.leave();
  });

  test('own room: a host who drops hands over to the next one in at once; an empty room closes', async () => {
    const host = await join('create', ROOM_NAME, { private: true, name: 'Host', skin: 0, play: true });
    const id = host.roomId;
    const sr = serverRoom(id);
    const second = await join('joinById', id, { name: 'Second', skin: 0, play: true });
    const third = await join('joinById', id, { name: 'Third', skin: 0, play: true });
    await waitFor(() => second.state.ownerId === host.sessionId, 1000, 'host owns');
    host.reconnection.enabled = false;
    BattleRoom.reconnectSeconds = 0.3; // the dropped host's seat is held this long
    (sr.clients.getById(host.sessionId) as unknown as { ref: { terminate(): void } }).ref.terminate();
    // no 20 s reconnection wait: the next one who joined takes over right away
    await waitFor(() => second.state.ownerId === second.sessionId, 1000, 'handed to the next one in');
    await second.leave();
    await waitFor(() => third.state.ownerId === third.sessionId, 1000, 'handed again');
    await third.leave();
    await waitFor(() => !matchMaker.getLocalRoomById(id), 3000, 'empty room disposed');
    BattleRoom.reconnectSeconds = 20;
  });

  test('reconnection keeps the player in the arena; expiry removes them', async () => {
    const r = await join('create', ROOM_NAME, { private: true, name: 'Flaky', skin: 0, bots: 0, play: true });
    const other = await join('joinById', r.roomId, { name: 'Stable', skin: 0, play: true });
    r.reconnection.minUptime = 0;
    const sr = serverRoom(r.roomId);
    await waitFor(() => r.state.players?.size === 2, 1000, 'joined');
    const sid = r.sessionId;
    let dropped = false, back = false;
    r.onDrop(() => { dropped = true; });
    r.onReconnect(() => { back = true; });
    (sr.clients.getById(sid) as unknown as { ref: { terminate(): void } }).ref.terminate();
    await waitFor(() => dropped, 2000, 'drop');
    expect(sr.sim.state.players.has(sid)).toBe(true);
    await waitFor(() => back, 5000, 'reconnect');
    expect(r.sessionId).toBe(sid);
    hold(r, 200, 1, 0);
    await waitFor(() => sr.sim.state.players.get(sid)?.ackSeq === seq, 2000, 'inputs after reconnect');

    BattleRoom.reconnectSeconds = 0.3;
    r.reconnection.enabled = false;
    (sr.clients.getById(sid) as unknown as { ref: { terminate(): void } }).ref.terminate();
    await waitFor(() => !sr.sim.state.players.has(sid), 3000, 'expired player removed');
    BattleRoom.reconnectSeconds = 20;
    await other.leave();
  });
});

describe('state sync', () => {
  test('round start with a bigger map: decoded client state matches the sim exactly', async () => {
    const src = await createPrivateRoom({ name: 'Sync', skin: 0, serverUrl: url, bots: 4, predict });
    sources.push(src);
    const sr = serverRoom(src.roomId);
    let last = performance.now();
    const pump = async (ms: number) => {
      const end = performance.now() + ms;
      while (performance.now() < end) { await sleep(10); const n = performance.now(); src.update(n - last, { dx: 0, dy: 0, buttons: 0 }); last = n; }
    };
    if (!useStub) {
      while (sr.sim.state.phase !== 2) await pump(50); // 5 players -> bigger map at round start
      await pump(1500); // let bots blow some bricks
    }
    sr.setSimulationInterval(); // freeze the sim; patches keep flowing
    await pump(200);
    const w = src.world!, s = sr.sim.state;
    expect(w.width).toBe(s.width);
    expect(w.height).toBe(s.height);
    if (!useStub) expect(s.width * s.height).toBeGreaterThan(15 * 13);
    expect(Array.from(w.tiles)).toEqual(Array.from(s.tiles));
    expect([...w.players.keys()].sort()).toEqual([...s.players.keys()].sort());
    for (const [id, p] of s.players) {
      const c = w.players.get(id)!;
      const a = (src as unknown as { model: { world: typeof w } }).model.world.players.get(id)!; // authoritative mirror
      expect(a.x).toBeCloseTo(p.x, 4);
      expect(a.y).toBeCloseTo(p.y, 4);
      expect(Math.hypot(c.x - p.x, c.y - p.y)).toBeLessThan(0.5); // view: interpolated / extrapolated
      expect(c.effects).toEqual(p.effects);
      expect([c.alive, c.inRound, c.bombs, c.radius, c.respawnIn, c.ackSeq]).toEqual([p.alive, p.inRound, p.bombs, p.radius, p.respawnIn, p.ackSeq]);
    }
    expect([...w.bombs.keys()].sort()).toEqual([...s.bombs.keys()].sort());
    for (const [id, b] of s.bombs) expect(w.bombs.get(id)!.fuse).toBe(b.fuse);
    expect([...w.flames.keys()].sort()).toEqual([...s.flames.keys()].sort());
    expect([...w.pickups.keys()].sort()).toEqual([...s.pickups.keys()].sort());
    expect([w.phase, w.phaseTicks, w.round, w.tick, w.zoneRing, w.zoneIn]).toEqual([s.phase, s.phaseTicks, s.round, s.tick, s.zoneRing, s.zoneIn]);
  }, 15000);
});

describe('NetSource (client)', () => {
  test('prediction, interpolation, events, ping, chat', async () => {
    const src = await createPrivateRoom({ name: 'Net', skin: 4, serverUrl: url + '/api', bots: 0, predict });
    sources.push(src);
    const peer = await join('joinById', src.roomId, { name: 'Peer', skin: 5, play: true });
    let last = performance.now();
    const step = async (ms: number, dx: number, dy: number, buttons = 0) => {
      const end = performance.now() + ms;
      while (performance.now() < end) {
        await sleep(8);
        const now = performance.now();
        src.update(now - last, { dx, dy, buttons });
        if (Math.random() < 0.5) sendFrames(peer, 1, 0, 0); // keep the peer fed
        last = now;
      }
    };
    const sr = serverRoom(src.roomId);
    const movable = () => {
      const p = sr.sim.state.players.get(src.localId);
      return p && p.alive && p.inRound && sr.sim.state.phase === (useStub ? 0 : 2); // Playing (stub: no phases)
    };
    // countdown -> playing (keep updating so the source stays live)
    while (!src.localId) await step(20, 0, 0);
    expect(src.localId).toBe(src.sessionId);
    const until = Date.now() + 8000;
    while (!movable() && Date.now() < until) await step(50, 0, 0);
    expect(movable()).toBe(true);
    await step(100, 0, 0);
    const w = src.world!;
    const me0 = { ...w.players.get(src.localId)! };
    const dx = me0.x < w.width / 2 ? 1 : -1;
    await step(500, dx, 0);
    const me = w.players.get(src.localId)!;
    expect(Math.abs(me.x - me0.x)).toBeGreaterThan(0.4);
    await step(300, 0, 0);
    // predicted local position converges to the server's
    const auth = sr.sim.state.players.get(src.localId)!;
    expect(Math.abs(me.x - auth.x)).toBeLessThan(0.05);
    expect(Math.abs(me.y - auth.y)).toBeLessThan(0.05);
    // remote players are present and interpolated near their server position
    const remote = w.players.get(peer.sessionId)!;
    const rAuth = sr.sim.state.players.get(peer.sessionId)!;
    expect(Math.abs(remote.x - rAuth.x) + Math.abs(remote.y - rAuth.y)).toBeLessThan(0.5);
    expect(src.players.length).toBe(sr.sim.state.players.size);

    await step(80, 0, 0, Button.Bomb);
    await step(400, 0, 0);
    const ev = src.drainEvents();
    const placed = ev.filter((e) => e.type === 'bombPlaced' && e.owner === src.localId);
    expect(placed.length).toBe(1); // predicted locally (bomb -1, server echo swallowed) or server's
    expect(src.drainEvents().length).toBe(0);
    expect(w.bombs.size).toBe(sr.sim.state.bombs.size); // view bombs (interpolated copies)

    await waitFor(() => src.ping > 0, 3000, 'ping');
    const chats: ChatMessage[] = [];
    src.onChat((m) => chats.push(m));
    src.sendChat('hello');
    await waitFor(() => chats.find((m) => m.text === 'hello'), 1000, 'chat');
    await peer.leave();
  }, 20000);

  test('quick play: MAIN as spectator, play(true) / play(false)', async () => {
    const src = await connectQuickPlay({ name: 'Quick', skin: 1, serverUrl: url, predict });
    sources.push(src);
    expect(src.roomId).toBe('MAIN');
    let last = performance.now();
    const pump = async (ms: number) => {
      const end = performance.now() + ms;
      while (performance.now() < end) { await sleep(10); const n = performance.now(); src.update(n - last, { dx: 0, dy: 0, buttons: 0 }); last = n; }
    };
    await pump(150);
    expect(src.world).not.toBeNull();
    expect([src.localId, src.isPlaying, src.spectators]).toEqual(['', false, 1]);
    expect(await src.play(true)).toBe(true);
    await pump(150);
    const humans = () => src.players.filter((p) => !p.isBot).length; // MAIN also has bots now
    expect([src.localId, src.isPlaying, src.spectators, humans()]).toEqual([src.sessionId, true, 0, 1]);
    expect(src.maxPlayers).toBe(32);
    expect(await src.play(false)).toBe(false);
    await pump(150);
    expect([src.localId, src.isPlaying, humans()]).toEqual(['', false, 0]);
    const rooms = await listRooms(url + '/api');
    expect(rooms.some((r) => r.roomId === 'MAIN')).toBe(true);
  });

  test('private room + join by code + status on disconnect', async () => {
    const host = await createPrivateRoom({ name: 'H', skin: 0, serverUrl: url, bots: 0, predict });
    sources.push(host);
    const guest = await joinRoomByCode(host.roomId.toLowerCase(), { name: 'G', skin: 1, serverUrl: url, predict });
    sources.push(guest);
    expect(guest.roomId).toBe(host.roomId);
    expect((await listRooms(url)).some((r) => r.roomId === host.roomId)).toBe(false);
    const statuses: string[] = [];
    guest.onStatus((s) => statuses.push(s));
    await serverRoom(host.roomId).disconnect();
    await waitFor(() => guest.status === 'disconnected', 2000, 'disconnected');
    expect(statuses).toContain('disconnected');
    await expect(joinRoomByCode('ZZZZZ', { name: 'x', skin: 0, serverUrl: url })).rejects.toThrow();
  });
});

describe('pushing over the network', () => {
  test('the pushed hero moves on the server and the pusher predicts it without corrections', async () => {
    const a = await createPrivateRoom({ name: 'Pusher', skin: 0, bots: 0, serverUrl: url });
    const b = await joinRoomByCode(a.roomId, { name: 'Target', skin: 1, play: true, serverUrl: url });
    sources.push(a, b);
    const sim = serverRoom(a.roomId).sim as Game.Simulation;
    sim.holdRound = true;
    let t = performance.now();
    const frame = (dx: number) => {
      const n = performance.now();
      a.update(n - t, { dx, dy: 0, buttons: 0 });
      b.update(n - t, { dx: 0, dy: 0, buttons: 0 });
      t = n;
    };
    const live = () => sim.state.phase === Game.Phase.Playing && [...sim.state.players.values()].every((p) => p.inRound && p.alive);
    for (let i = 0; i < 300 && !(sim.state.players.size === 2 && live()); i++) { frame(0); await sleep(16); }
    const w = sim.state;
    for (let x = 0; x < w.width; x++) w.tiles[x] = Game.Tile.Floor;
    const sa = w.players.get(a.localId)!, sb = w.players.get(b.localId)!;
    sa.x = 0; sa.y = 0; sb.x = 0.6; sb.y = 0;
    for (let i = 0; i < 30; i++) { frame(0); await sleep(16); }
    let maxErr = 0, sumErr = 0, samples = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 1200) {
      frame(1);
      await sleep(16);
      const s = a as unknown as { errX: number; errY: number };
      const e = Math.hypot(s.errX, s.errY);
      maxErr = Math.max(maxErr, e); sumErr += e; samples++;
    }
    expect(sb.x).toBeGreaterThan(1.5);                        // B was shoved along
    expect(sb.x - sa.x).toBeGreaterThanOrEqual(0.49);          // and they don't overlap
    // prediction matches the server: without push prediction the pusher was corrected all the time
    // (avg ~0.05, peaks ~0.1 tiles); a slow CI box may still show a lone sub-pixel blip
    expect(sumErr / samples).toBeLessThan(0.01);
    expect(maxErr).toBeLessThan(0.06);
    a.dispose(); b.dispose();
  });
});

describe('anti-cheat', () => {
  test('per-IP connection cap and room-creation rate', async () => {
    Object.assign(limits, { ...STRICT, clientsPerIp: 2, createBurst: 1, createsPerSecond: 1e-6 });
    resetLimits();
    try {
      const a = await join('joinById', 'MAIN', { name: 'ip1', skin: 0 });
      const b = await join('joinById', 'MAIN', { name: 'ip2', skin: 0 });
      await expect(join('joinById', 'MAIN', { name: 'ip3', skin: 0 })).rejects.toThrow();
      await b.leave();
      await sleep(300); // onLeave releases the IP slot
      const c = await join('create', ROOM_NAME, { private: true, name: 'mk1', skin: 0, bots: 0 });
      await expect(join('create', ROOM_NAME, { private: true, name: 'mk2', skin: 0, bots: 0 })).rejects.toThrow();
      await Promise.all([a.leave(), c.leave()]);
    } finally {
      relax();
      resetLimits();
    }
  });

  test('crazy bombs: real fuse and radius are not sent', () => {
    const w = (G.createWorld as (w: number, h: number, s: number) => Game.WorldState)(13, 13, 1);
    w.bombs.set(1, {
      id: 1, owner: 'a', kind: Game.BombKind.Crazy, x: 3, y: 3, radius: 7, fuse: 123, motion: Game.BombMotion.Idle,
      vx: 0, vy: 0, fromX: 3, fromY: 3, toX: 3, toY: 3, progress: 0, passers: [], dud: true,
    });
    const s = new BattleState();
    syncWorld(s, w);
    const b = s.bombs.get('1')!;
    expect(b.radius).toBe(0);
    expect(b.fuseAt).toBe(-1);
  });

  test('«Отключиться» mid-round keeps the hero in the arena for a moment', async () => {
    const h = await join('create', ROOM_NAME, { private: true, name: 'Leaver', skin: 0, bots: 0, play: true });
    const sr = serverRoom(h.roomId);
    await waitFor(() => sr.sim.state.phase === Game.Phase.Playing && sr.sim.state.players.get(h.sessionId)?.inRound, 4000, 'playing');
    h.send(MSG.play, false);
    await sleep(300);
    expect(sr.sim.state.players.has(h.sessionId)).toBe(true);
    await waitFor(() => !sr.sim.state.players.has(h.sessionId), 4000, 'removed after grace');
    await h.leave();
  });

  test('names: reserved prefixes are refused, duplicates get a suffix', async () => {
    const a = await join('create', ROOM_NAME, { private: true, name: '@server', skin: 0, bots: 0, play: true });
    const b = await join('joinById', a.roomId, { name: 'Twin', skin: 0, play: true });
    const c = await join('joinById', a.roomId, { name: 'twin', skin: 0, play: true });
    const sr = serverRoom(a.roomId);
    await waitFor(() => sr.sim.state.players.size === 3, 2000, 'players');
    const name = (id: string) => sr.sim.state.players.get(id)!.name;
    expect(name(a.sessionId).startsWith('@')).toBe(false);
    expect(name(a.sessionId).toLowerCase()).not.toContain('server');
    expect(name(b.sessionId)).toBe('Twin');
    expect(name(c.sessionId)).toBe('twin 2');
    await Promise.all([a.leave(), b.leave(), c.leave()]);
  });
});
