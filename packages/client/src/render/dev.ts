// Render harness: a live local Simulation with wandering bots, driven by the keyboard.
//   http://localhost:8080/render/dev.html?bots=5&skin=0&quality=high
// Keys: WASD/arrows move, Space bomb, E/Shift action.
//   1 spawn every pickup   2 toggle all effects   3 stun   4 sudden death   5 all abilities
//   6 abilities w/o remote   Q quality   V spectate   C camera mode   P pause   R new round   N next map
//   ?attract  starts as a menu backdrop (localId '' + attract camera)
//   ?shape=N  always arena shape N (0 rect, 1 circle, 2 diamond, 3 cross, 4 ring)
import {
  Ability, Bot, Button, Curse, Phase, PickupType, ROUND_TIME, STUN_TIME, Simulation, TICK_MS, Tile, sec,
  type GameEvent,
} from '@ob/game';
import { createRenderer } from './index';

const params = new URLSearchParams(location.search);
const BOTS = Math.min(15, Number(params.get('bots') ?? 5));
const LOCAL = 'me';
let quality: 'low' | 'high' = params.get('quality') === 'low' ? 'low' : 'high';

// ?shape=0..4 : always that ArenaShape (rect, circle, diamond, cross, ring); random otherwise
const shape = params.get('shape');
const sim = new Simulation({
  minPlayers: Number(params.get('min') ?? 2), seed: (Date.now() & 0xffff) || 1, shapes: true,
  shape: shape === null ? undefined : Number(shape),
});
sim.addPlayer({ id: LOCAL, name: params.get('name') ?? 'You', skin: Number(params.get('skin') ?? 0) });
const NAMES = ['Bob', 'Алиса', 'Zed', 'Mia', 'Kotik', 'Rex', 'Lou', 'Ника', 'Dex', 'Ivy', 'Gus', 'Oz', 'Pip', 'Tom', 'Uma'];
for (let i = 0; i < BOTS; i++) sim.addPlayer({ id: 'bot' + i, name: NAMES[i], skin: i + 1, isBot: true });

// ?map=75 : load a big ASCII arena (pillars + random bricks) to stress the static layer / camera
if (params.get('map')) {
  const n = Math.max(9, Number(params.get('map')) | 1);
  const rows: string[] = [];
  for (let y = 0; y < n; y++) {
    let r = '';
    for (let x = 0; x < n; x++) r += x % 2 === 1 && y % 2 === 1 ? '#' : Math.random() < 0.55 && (x > 2 || y > 2) ? 'B' : '.';
    rows.push(r);
  }
  sim.loadMap(rows);
  for (const p of sim.state.players.values()) {
    for (;;) {
      const x = Math.floor(Math.random() * n), y = Math.floor(Math.random() * n);
      if (sim.state.tiles[y * n + x] !== Tile.Floor) continue;
      p.x = x; p.y = y; p.alive = true; p.inRound = true; break;
    }
  }
}

// ---------------------------------------------------------------- input
const held = new Set<string>();
addEventListener('keydown', e => { held.add(e.code); onKey(e.code); if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', e => held.delete(e.code));
addEventListener('blur', () => held.clear());

function localInput() {
  let dx = 0, dy = 0;
  if (held.has('KeyA') || held.has('ArrowLeft')) dx -= 1;
  if (held.has('KeyD') || held.has('ArrowRight')) dx += 1;
  if (held.has('KeyW') || held.has('ArrowUp')) dy -= 1;
  if (held.has('KeyS') || held.has('ArrowDown')) dy += 1;
  const l = Math.hypot(dx, dy) || 1;
  let buttons = 0;
  if (held.has('Space')) buttons |= Button.Bomb;
  if (held.has('KeyE') || held.has('ShiftLeft') || held.has('ShiftRight')) buttons |= Button.Action;
  return { dx: dx / l, dy: dy / l, buttons };
}

// ---------------------------------------------------------------- bots (the real AI from @ob/game)
const DIFFS = ['easy', 'normal', 'hard'] as const;
const bots = [...sim.state.players.keys()].filter(id => id !== LOCAL).map((id, i) => new Bot(id, DIFFS[i % 3]));

// ---------------------------------------------------------------- cheats
let paused = false;
let spectate = params.has('attract');
const MODES = ['follow', 'overview', 'attract'] as const;
let camMode = params.has('attract') ? 2 : 0;
let allFx = false;
function onKey(code: string) {
  const w = sim.state;
  const me = w.players.get(LOCAL);
  switch (code) {
    case 'Digit1': {
      if (!me) break;
      const types = Object.values(PickupType).filter(v => typeof v === 'number') as PickupType[];
      const cx = Math.round(me.x), cy = Math.round(me.y);
      let i = 0;
      for (let r = 1; r < 8 && i < types.length; r++) for (let y = cy - r; y <= cy + r && i < types.length; y++) for (let x = cx - r; x <= cx + r && i < types.length; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
        if (x < 0 || y < 0 || x >= w.width || y >= w.height) continue;
        if (w.tiles[y * w.width + x] === Tile.Wall) continue;
        w.tiles[y * w.width + x] = Tile.Floor;
        sim.spawnPickup(x, y, types[i++]);
      }
      break;
    }
    case 'Digit2': {
      if (!me) break;
      allFx = !allFx;
      const v = allFx ? sec(20) : 0;
      Object.assign(me.effects, { shield: v, ghost: v, crazy: v, fire: v, curse: v });
      me.curse = allFx ? Curse.Reverse : Curse.None;
      me.speedLevel = allFx ? 3 : 0;
      break;
    }
    case 'Digit3': if (me) me.effects.stun = STUN_TIME; break;
    case 'Digit4': sim.ctx.zoneQuiet = 0; break; // the zone warning starts on the next tick
    case 'Digit5': case 'Digit6': {
      if (!me) break;
      me.abilities |= Ability.Kick | Ability.Glove | Ability.Punch | Ability.LineBomb;
      if (code === 'Digit5') me.abilities |= Ability.Remote;
      me.bombs = 6; me.radius = 4;
      break;
    }
    case 'KeyQ': quality = quality === 'high' ? 'low' : 'high'; renderer.setQuality(quality); break;
    case 'KeyV': spectate = !spectate; break;
    case 'KeyC': camMode = (camMode + 1) % 3; renderer.setCameraMode(MODES[camMode]); break;
    case 'KeyP': paused = !paused; break;
    case 'KeyN': w.phase = Phase.RoundOver; w.phaseTicks = 1; break; // next map (camera travel + spawns)
    case 'KeyR': w.phase = Phase.Playing; w.phaseTicks = ROUND_TIME; for (const p of w.players.values()) if (p.id !== LOCAL) p.alive = false; break;
  }
}

// ---------------------------------------------------------------- loop
const parent = document.getElementById('game')!;
const hud = document.getElementById('hud')!;
const renderer = await createRenderer({ parent, quality });
renderer.setCameraMode(MODES[camMode]);
// Deterministic driving for headless checks: __dev.manual = true stops the rAF loop, then
// __dev.tick(ms) advances the sim and renders exactly `ms`; __dev.bomb(x, y, r, fuseTicks) drops a bomb.
const dev = {
  sim, renderer, LOCAL, manual: false,
  bomb(x: number, y: number, radius = 3, fuse = 1, owner = LOCAL) {
    const w = sim.state;
    const id = w.nextId++;
    w.bombs.set(id, {
      id, owner, kind: 0, x, y, radius, fuse, motion: 0, vx: 0, vy: 0, fromX: x, fromY: y, toX: x, toY: y,
      progress: 0, passers: [], dud: false,
    } as never);
    (sim.ctx.bombs as Map<number, unknown>).set(id, { pierce: false, credit: owner, flightTotal: 0, flightElapsed: 0, flightDx: 0, flightDy: 0, hops: 0 });
    return id;
  },
  tick(ms: number) {
    const events: GameEvent[] = [];
    let left = ms;
    while (left >= TICK_MS - 1e-6) {
      left -= TICK_MS;
      seq++;
      sim.pushInput(LOCAL, { seq, dx: 0, dy: 0, buttons: 0 });
      events.push(...sim.step());
    }
    const localId = spectate ? '' : LOCAL;
    if (events.length) renderer.handleEvents(events, localId);
    renderer.render(sim.state, localId, ms);
    return events.map(e => e.type);
  },
};
(window as unknown as { __dev: unknown }).__dev = dev;

let seq = 0;
let acc = 0;
let last = performance.now();
let fpsT = 0, fpsN = 0, fps = 0;
function frame(now: number) {
  const dt = Math.min(100, now - last);
  last = now;
  if (dev.manual) { requestAnimationFrame(frame); return; }
  const events: GameEvent[] = [];
  if (!paused) {
    acc += dt;
    while (acc >= TICK_MS) {
      acc -= TICK_MS;
      seq++;
      sim.pushInput(LOCAL, { seq, ...localInput() });
      for (const b of bots) sim.pushInput(b.id, b.think(sim.state));
      events.push(...sim.step());
    }
  }
  const localId = spectate ? '' : LOCAL;
  if (events.length) renderer.handleEvents(events, localId);
  renderer.render(sim.state, localId, paused ? 0 : dt);
  fpsN++; fpsT += dt;
  if (fpsT > 500) { fps = Math.round(fpsN * 1000 / fpsT); fpsN = 0; fpsT = 0; }
  const w = sim.state;
  hud.textContent = `${fps} fps  ${quality}  phase ${Phase[w.phase]} ${w.phaseTicks}  round ${w.round}  ${w.width}x${w.height}\n`
    + `bombs ${w.bombs.size} flames ${w.flames.size} pickups ${w.pickups.size} falling ${w.falling.length}\n`
    + 'WASD Space E | 1 pickups 2 effects 3 stun 4 sudden 5/6 abilities Q quality V spectate C camera(' + MODES[camMode] + ') P pause R round N map';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
