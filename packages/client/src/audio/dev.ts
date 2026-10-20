// Dev harness for the procedural audio engine: /audio/dev.html
import { Curse, Dir, emptyEffects, FlameShape, Phase, PickupType, type GameEvent, type PlayerState, type WorldState } from '@ob/game';
import type { MusicMode, UiSound } from '../contracts';
import { createAudio } from './index';
import { runAnalysis, type Row } from './analysis';

const audio = createAudio();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------------------------------------------------------- fake world
const W = 15, H = 13;
function mkPlayer(id: string, x: number, y: number): PlayerState {
  return {
    id, name: id, skin: 0, isBot: id !== 'me', x, y, dir: Dir.Down, moving: false, alive: true, inRound: true,
    lives: 0, bombs: 1, radius: 2, speedLevel: 0, abilities: 0, curse: Curse.None,
    effects: emptyEffects(),
    carrying: -1, respawnIn: 0, wins: 0, kills: 0, deaths: 0, ackSeq: 0,
  };
}
const world: WorldState = {
  tick: 0, seed: 1, phase: Phase.Playing, phaseTicks: 0, round: 1, width: W, height: H,
  tiles: new Uint8Array(W * H),
  players: new Map([
    ['me', mkPlayer('me', 7, 6)],
    ['left', mkPlayer('left', 3, 6)],
    ['right', mkPlayer('right', 12, 6)],
    ['far', mkPlayer('far', 14, 12)],
  ]),
  bombs: new Map(), flames: new Map(), pickups: new Map(), falling: [], drops: [], winner: '', nextId: 1, zoneRing: 0, zoneIn: 0,
};
const LOCAL = 'me';

type Pos = 'me' | 'left' | 'right' | 'far' | 'none';
let pos: Pos = 'me';
let id = 1;
const at = () => {
  const p = pos === 'none' ? world.players.get('me')! : world.players.get(pos)!;
  return { x: p.x, y: p.y, who: pos === 'none' ? 'me' : pos };
};
const send = (evs: GameEvent[]) => audio.handleEvents(evs, world, LOCAL);

function explosion(power: number, x: number, y: number): GameEvent {
  return { type: 'explosion', bomb: id++, owner: 'me', x, y, power, cells: [{ x, y, shape: FlameShape.Center }] };
}

const EVENTS: Record<string, () => GameEvent[]> = {
  bombPlaced: () => { const a = at(); return [{ type: 'bombPlaced', bomb: id++, x: a.x, y: a.y, owner: a.who }]; },
  'explosion r1': () => { const a = at(); return [explosion(1, a.x, a.y)]; },
  'explosion r4': () => { const a = at(); return [explosion(4, a.x, a.y)]; },
  'explosion r8': () => { const a = at(); return [explosion(8, a.x, a.y)]; },
  bombFizzled: () => { const a = at(); return [{ type: 'bombFizzled', bomb: id++, x: a.x, y: a.y }]; },
  brickDestroyed: () => { const a = at(); return [{ type: 'brickDestroyed', x: a.x, y: a.y }]; },
  pickupSpawned: () => { const a = at(); return [{ type: 'pickupSpawned', pickup: id++, x: a.x, y: a.y, kind: PickupType.BombUp }]; },
  'collect BombUp': () => [{ type: 'pickupCollected', pickup: id++, by: at().who, kind: PickupType.BombUp }],
  'collect Kick': () => [{ type: 'pickupCollected', pickup: id++, by: at().who, kind: PickupType.Kick }],
  'collect Skull': () => [{ type: 'pickupCollected', pickup: id++, by: at().who, kind: PickupType.Skull }],
  'collect Heart': () => [{ type: 'pickupCollected', pickup: id++, by: at().who, kind: PickupType.Heart }],
  'collect Shield': () => [{ type: 'pickupCollected', pickup: id++, by: at().who, kind: PickupType.Shield }],
  pickupBurned: () => { const a = at(); return [{ type: 'pickupBurned', pickup: id++, x: a.x, y: a.y }]; },
  shieldBlocked: () => [{ type: 'shieldBlocked', player: at().who }],
  bombKicked: () => [{ type: 'bombKicked', bomb: id++, by: at().who, dir: Dir.Right }],
  bombGrabbed: () => [{ type: 'bombGrabbed', bomb: id++, by: at().who }],
  bombThrown: () => { const a = at(); return [{ type: 'bombThrown', bomb: id++, by: a.who, toX: a.x + 3, toY: a.y }]; },
  bombPunched: () => { const a = at(); return [{ type: 'bombPunched', bomb: id++, by: a.who, toX: a.x + 3, toY: a.y }]; },
  bombBounced: () => { const a = at(); return [{ type: 'bombBounced', bomb: id++, x: a.x, y: a.y }]; },
  bombLanded: () => { const a = at(); return [{ type: 'bombLanded', bomb: id++, x: a.x, y: a.y }]; },
  bombStopped: () => { const a = at(); return [{ type: 'bombStopped', bomb: id++, x: a.x, y: a.y }]; },
  playerStunned: () => [{ type: 'playerStunned', player: at().who }],
  playerDied: () => { const a = at(); return [{ type: 'playerDied', player: a.who, killer: 'left', x: a.x, y: a.y, cause: 'blast' }]; },
  playerRespawned: () => { const a = at(); return [{ type: 'playerRespawned', player: a.who, x: a.x, y: a.y }]; },
  curseApplied: () => [{ type: 'curseApplied', player: at().who, curse: Curse.Reverse, from: '' }],
  effectEnded: () => [{ type: 'effectEnded', player: at().who, effect: 'shield' }],
  'countdown 3': () => [{ type: 'countdown', seconds: 3 }],
  'countdown 1': () => [{ type: 'countdown', seconds: 1 }],
  'countdown 0 (GO)': () => [{ type: 'countdown', seconds: 0 }],
  roundStart: () => [{ type: 'roundStart', round: 1 }],
  suddenDeath: () => [{ type: 'suddenDeath' }],
  blockFell: () => { const a = at(); return [{ type: 'blockFell', x: a.x, y: a.y }]; },
  'roundOver (win)': () => [{ type: 'roundOver', winner: 'me' }],
  'roundOver (lose)': () => [{ type: 'roundOver', winner: 'left' }],
};

// ---------------------------------------------------------------- UI
function button(parent: HTMLElement, label: string, fn: () => void) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => { audio.unlock(); fn(); });
  parent.appendChild(b);
  return b;
}

const status = $('status');
const refreshStatus = () => { status.textContent = 'unlocked (pre-rendering sfx in background)'; };
$('unlock').addEventListener('click', () => { audio.unlock(); refreshStatus(); });

for (const k of ['master', 'sfx', 'music'] as const) {
  const el = $<HTMLInputElement>(`v-${k}`);
  el.addEventListener('input', () => audio.setVolume({ [k]: Number(el.value) }));
}

const musicRow = $('music');
const musicBtns: HTMLButtonElement[] = [];
for (const m of ['off', 'menu', 'waiting', 'battle', 'sudden', 'victory', 'defeat'] as MusicMode[]) {
  const b = button(musicRow, m, () => {
    audio.setMusic(m);
    for (const x of musicBtns) x.classList.toggle('on', x === b);
    refreshStatus();
  });
  musicBtns.push(b);
}

const posRow = $('pos');
const posBtns: HTMLButtonElement[] = [];
const POS_LABEL: Record<Pos, string> = { me: 'local player (centred)', left: 'other, 4 tiles left', right: 'other, 5 tiles right', far: 'other, far bottom-right', none: 'no position' };
for (const p of Object.keys(POS_LABEL) as Pos[]) {
  const b = button(posRow, POS_LABEL[p], () => { pos = p; for (const x of posBtns) x.classList.toggle('on', x === b); });
  b.classList.toggle('on', p === pos);
  posBtns.push(b);
}

const evRow = $('events');
for (const [name, mk] of Object.entries(EVENTS)) button(evRow, name, () => send(mk()));
button(evRow, 'CHAIN x10', () => {
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      const x = 2 + i, y = 6;
      send([explosion(6, x, y), { type: 'brickDestroyed', x, y: y - 1 }, { type: 'brickDestroyed', x, y: y + 1 }]);
    }, i * 50);
  }
});
button(evRow, 'countdown sequence', () => {
  [3, 2, 1].forEach((s, i) => setTimeout(() => send([{ type: 'countdown', seconds: s }]), i * 1000));
  setTimeout(() => send([{ type: 'roundStart', round: 1 }]), 3000);
});

const uiRow = $('ui');
for (const s of ['hover', 'click', 'back', 'join', 'chat', 'error', 'tick'] as UiSound[]) {
  const b = button(uiRow, s, () => audio.ui(s));
  if (s === 'hover') b.addEventListener('mouseenter', () => audio.ui('hover'));
}

// ---------------------------------------------------------------- analysis
function renderTable(rows: Row[]) {
  const t = $('table');
  t.innerHTML = '<tr><th>name</th><th>peak</th><th>rms dB</th><th>dur s</th><th>ok</th><th>note</th></tr>';
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.name}</td><td>${r.peak}</td><td>${r.rmsDb}</td><td>${r.dur}</td><td class="${r.ok ? 'ok' : 'bad'}">${r.ok ? 'ok' : 'FAIL'}</td><td>${r.note}</td>`;
    t.appendChild(tr);
  }
}

declare global { interface Window { __audioAnalysis?: { ok: boolean; rows: Row[] }; __audio?: unknown } }
window.__audio = audio;

$('analyze').addEventListener('click', async () => {
  const v = $('verdict');
  v.textContent = 'rendering…';
  try {
    const res = await runAnalysis(48000);
    window.__audioAnalysis = res;
    renderTable(res.rows);
    v.textContent = res.ok ? 'PASS' : 'FAIL';
    v.className = res.ok ? 'ok' : 'bad';
  } catch (e) {
    console.error('[audio-analysis] crashed', e);
    v.textContent = 'crashed: ' + String(e);
    v.className = 'bad';
  }
});
