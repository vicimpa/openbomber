// Standalone mock so every screen / HUD element can be seen without the sim, server or renderer.
// `installMockActions()` binds the store actions to a scripted fake world (main.tsx calls it;
// the session layer's bindActions() overrides it). Canon flow: after the loader you spectate a
// shared world of bots; «Подключиться» adds you, «Отключиться» removes you. The stage gets a
// placeholder canvas (grass, grey walls, bricks, dots for players; the local dot follows input).
import {
  Ability, Button, COUNTDOWN_TIME, Curse, Dir, Phase, type GameEvent, type PlayerState, RESPAWN_DELAY,
  ROUND_OVER_TIME, sec, SPAWN_INVULNERABLE, TICK_RATE, Tile, type WorldState,
} from '@ob/game';
import { effect } from '@preact/signals';
import type { InputManager } from '$/contracts';
import { createInput } from '$/input';
import { buildHud, effectTotal } from './hud';
import { t } from './i18n';
import {
  bindActions, connectStatus, fps, handleGameEvents, hud, pushChat, resetGameState, room, screen,
  settings, spectators, stage, uiCapturesInput,
} from './store';
import { SKIN_COUNT } from './settings';

const LOCAL = 'me';
const BOT_NAMES = ['Бабах', 'Фитиль', 'Сапёр', 'Тротил', 'Пончик', 'Енот', 'Кактус'];
const BOT_LINES = ['gg', 'кто взял пинок?', 'ахаха', 'ну держись', 'лол', 'ещё раунд!', 'кто кинул бомбу через стену??'];
const COLORS = ['#ff4040', '#2fd6ff', '#ffd23f', '#8cff4f', '#ff8f1f', '#b47cff', '#ff5ab0', '#46e0b0'];

type Fx = Record<string, number>;

function makePlayer(id: string, name: string, skin: number, isBot: boolean, x: number, y: number): PlayerState {
  return {
    id, name, skin, isBot, x, y, dir: Dir.Down, moving: false, alive: true, inRound: true, lives: 0, teleports: 0,
    bombs: 1, radius: 1, speedLevel: 0, abilities: 0, curse: Curse.None,
    effects: {
      shield: 0, ghost: 0, crazy: 0, fire: 0, curse: 0, invulnerable: 0, stun: 0, speed: 0,
      kick: 0, glove: 0, punch: 0, remote: 0, pierce: 0, lineBomb: 0, bombPass: 0,
    },
    carrying: -1, respawnIn: 0, wins: 0, kills: 0, deaths: 0, ackSeq: 0, guessed: 0,
  };
}

function makeWorld(bots: number): WorldState {
  const width = 19, height = 13;
  const tiles = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (x % 2 === 1 && y % 2 === 1) tiles[y * width + x] = Tile.Wall;
      else if (Math.random() < 0.5 && !(x < 3 && y < 3) && !(x > width - 4 && y > height - 4)) tiles[y * width + x] = Tile.Brick;
    }
  const s = settings.peek();
  const players = new Map<string, PlayerState>();
  const spawns = [[18, 12], [18, 0], [0, 12], [9, 0], [9, 12], [0, 6], [18, 6]];
  for (let i = 0; i < bots; i++) {
    const [x, y] = spawns[i % spawns.length];
    players.set(`bot${i}`, makePlayer(`bot${i}`, BOT_NAMES[i % BOT_NAMES.length], (s.skin + 1 + i * 2) % SKIN_COUNT, true, x, y));
  }
  return {
    tick: 0, seed: 1, phase: Phase.Playing, phaseTicks: 0, round: 1, width, height, shape: 0, theme: 0, weather: 0, tiles,
    players, bombs: new Map(), flames: new Map(), pickups: new Map(), falling: [], drops: [], winner: '', nextId: 1,
    zoneRing: 0, zoneIn: 0,
  };
}

interface Mock {
  world: WorldState;
  input: InputManager;
  online: boolean;
  ping: number;
  raf: number;
  script: number;           // ticks since the local player joined (scripted pickups)
  roundT: number;           // ticks since round start
  prevButtons: number;
  bombs: { x: number; y: number; t: number }[];
  disposers: (() => void)[];
}

let mock: Mock | null = null;

function startWorld(opts: { bots: number; online: boolean; code: string; isPrivate: boolean; join?: boolean }) {
  stopWorld();
  resetGameState();
  const world = makeWorld(Math.max(1, Math.min(7, opts.bots)));
  const m: Mock = {
    world, input: createInput(), online: opts.online, ping: opts.online ? 48 : 0, raf: 0, script: 0, roundT: 0,
    prevButtons: 0, bombs: [], disposers: [],
  };
  mock = m;
  room.value = { code: opts.code, isPrivate: opts.isPrivate, offline: !opts.online };
  spectators.value = opts.online ? [{ id: 's1', name: 'гость' }, { id: 's2', name: 'аноним' }] : [];
  screen.value = 'game';
  pushChat({ from: '', name: '@server', text: opts.isPrivate ? `Комната ${opts.code}: добро пожаловать!` : opts.online ? 'Добро пожаловать в OpenBomber!' : 'Офлайн-игра против ботов (мок)', at: Date.now() });
  if (opts.join) join(m);

  m.disposers.push(effect(() => m.input.setEnabled(!uiCapturesInput.value)));
  m.disposers.push(effect(() => {
    const el = stage.value;
    if (el) return attachPlaceholder(el, m);
  }));
  m.disposers.push(effect(() => {
    const s = settings.value;
    const me = m.world.players.get(LOCAL);
    if (me) { me.name = s.name; me.skin = s.skin; }
  }));

  let last = performance.now(), acc = 0, hudAcc = 0, frames = 0, fpsAcc = 0;
  const frame = (now: number) => {
    const dt = Math.min(100, now - last);
    last = now;
    acc += dt; hudAcc += dt; fpsAcc += dt; frames++;
    const input = m.input.sample();
    while (acc >= 1000 / TICK_RATE) { acc -= 1000 / TICK_RATE; step(m, input); }
    if (hudAcc >= 100) {
      hudAcc = 0;
      if (m.online) m.ping = Math.max(20, Math.min(220, m.ping + (Math.random() - 0.5) * 14));
      hud.value = buildHud(m.world, m.world.players.has(LOCAL) ? LOCAL : '', m.ping);
    }
    if (fpsAcc >= 500) { fps.value = Math.round((frames * 1000) / fpsAcc); frames = 0; fpsAcc = 0; }
    m.raf = requestAnimationFrame(frame);
  };
  m.raf = requestAnimationFrame(frame);
  hud.value = buildHud(m.world, '', m.ping);
}

function stopWorld() {
  if (!mock) return;
  cancelAnimationFrame(mock.raf);
  mock.disposers.forEach((d) => d());
  mock.input.dispose();
  mock = null;
}

function join(m: Mock) {
  const s = settings.peek();
  const me = makePlayer(LOCAL, s.name, s.skin, false, 0, 0);
  m.world.players.set(LOCAL, me);
  m.script = 0;
}

const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
function bots(w: WorldState) { return [...w.players.values()].filter((p) => p.isBot); }
function emit(m: Mock, events: GameEvent[]) { handleGameEvents(events, m.world, LOCAL); }

function kill(m: Mock, victim: PlayerState, killer: string) {
  if (!victim.alive) return;
  if (victim.lives > 0) { victim.lives--; victim.respawnIn = RESPAWN_DELAY; }
  victim.alive = false;
  victim.deaths++;
  const k = m.world.players.get(killer);
  if (k && k !== victim) k.kills++;
  emit(m, [{ type: 'playerDied', player: victim.id, killer, x: victim.x, y: victim.y, cause: 'blast' }]);
  if (victim.id === LOCAL) m.input.vibrate([60, 40, 120], 1);
}

function setFx(p: PlayerState, kind: string, seconds?: number) {
  (p.effects as unknown as Fx)[kind] = seconds ? sec(seconds) : effectTotal(kind);
}

function newRound(m: Mock) {
  const w = m.world;
  w.round++;
  w.phase = Phase.Countdown;
  w.phaseTicks = COUNTDOWN_TIME;
  w.winner = '';
  w.zoneIn = 0;
  w.zoneRing = 0;
  m.roundT = 0;
  m.script = 0;
  for (const p of w.players.values()) {
    Object.assign(p, { alive: true, inRound: true, lives: 0, bombs: 1, radius: 1, speedLevel: 0, abilities: 0, curse: Curse.None, carrying: -1, respawnIn: 0 });
    for (const k in p.effects) (p.effects as unknown as Fx)[k] = 0;
    if (p.id === LOCAL) { p.x = 0; p.y = 0; }
  }
  pushChat({ from: '', name: '@server', text: 'Размер карты был изменен', at: Date.now() });
}

/** One fake tick: a scripted sequence of pickups / deaths / chat / zone shrink. */
function step(m: Mock, input: { dx: number; dy: number; buttons: number }) {
  const w = m.world;
  w.tick++;
  m.script++;
  m.roundT++;
  const me = w.players.get(LOCAL);

  if (me?.alive && w.phase === Phase.Playing) {
    const sp = (2.8 + me.speedLevel * 0.35) / TICK_RATE;
    me.x = Math.max(0, Math.min(w.width - 1, me.x + input.dx * sp));
    me.y = Math.max(0, Math.min(w.height - 1, me.y + input.dy * sp));
    me.moving = !!(input.dx || input.dy);
  }
  const pressed = input.buttons & ~m.prevButtons;
  m.prevButtons = input.buttons;
  if (me?.alive) {
    if (pressed & Button.Bomb) { m.bombs.push({ x: Math.round(me.x), y: Math.round(me.y), t: sec(2) }); m.input.vibrate(18, 0.4); }
    if (pressed & Button.Action) { me.carrying = me.carrying >= 0 ? -1 : 1; m.input.vibrate(10, 0.3); }
  }
  m.bombs = m.bombs.filter((b) => --b.t > 0);

  for (const b of bots(w)) {
    if (!b.alive) continue;
    b.x = Math.max(0, Math.min(w.width - 1, b.x + Math.sin((w.tick + b.skin * 40) / 50) * 0.03));
    b.y = Math.max(0, Math.min(w.height - 1, b.y + Math.cos((w.tick + b.skin * 70) / 60) * 0.03));
  }

  for (const p of w.players.values()) {
    const e = p.effects as unknown as Fx;
    for (const k in e) if (e[k] > 0) e[k]--;
    if (e.curse === 0) p.curse = Curse.None;
    if (p.respawnIn > 0 && --p.respawnIn === 0) {
      p.alive = true;
      p.effects.invulnerable = SPAWN_INVULNERABLE;
      emit(m, [{ type: 'playerRespawned', player: p.id, x: p.x, y: p.y }]);
    }
  }

  if (m.roundT % sec(8) === 0 && w.phase !== Phase.RoundOver) {
    const b = rnd(bots(w));
    pushChat({ from: b.id, name: b.name, text: rnd(BOT_LINES), at: Date.now() });
  }

  // scripted boosts for the local player after joining
  if (me && me.inRound && w.phase === Phase.Playing) {
    const T = m.script;
    const script: Record<number, () => void> = {
      [sec(1)]: () => { me.bombs = 3; },
      [sec(2)]: () => { me.radius = 3; setFx(me, 'speed'); },
      [sec(3)]: () => { setFx(me, 'kick'); me.abilities |= Ability.Kick; },
      [sec(4)]: () => { setFx(me, 'shield'); },
      [sec(5)]: () => { setFx(me, 'glove'); setFx(me, 'remote', 12); me.abilities |= Ability.Glove | Ability.Remote; me.lives = 1; },
      [sec(6)]: () => {
        me.curse = rnd([Curse.Reverse, Curse.Diarrhea, Curse.Slow, Curse.TinyFlame]); setFx(me, 'curse');
        emit(m, [{ type: 'curseApplied', player: LOCAL, curse: me.curse, from: 'bot0' }]);
      },
      [sec(7)]: () => { const b = bots(w).find((p) => p.alive); if (b) kill(m, b, LOCAL); },
      [sec(8)]: () => { setFx(me, 'crazy'); setFx(me, 'fire', 4); },
    };
    script[T]?.();
  }

  switch (w.phase) {
    case Phase.Countdown:
      if (--w.phaseTicks <= 0) { w.phase = Phase.Playing; w.phaseTicks = 0; m.roundT = 0; }
      break;
    case Phase.Playing: {
      w.phaseTicks++;
      const T = m.roundT;
      if (T === sec(10)) w.zoneIn = sec(15);                         // canon: «Уменьшение размера карты через 15 сек»
      if (w.zoneIn && --w.zoneIn <= 0) { w.zoneIn = 0; w.zoneRing++; w.phase = Phase.SuddenDeath; w.phaseTicks = 0; emit(m, [{ type: 'suddenDeath' }]); }
      if (T === sec(14)) { const bs = bots(w); if (bs[1]) kill(m, bs[1], bs[2]?.id ?? bs[1].id); }
      if (T === sec(18)) { const bs = bots(w); if (bs[2]) kill(m, bs[2], bs[2].id); }
      break;
    }
    case Phase.SuddenDeath: {
      w.phaseTicks++;
      if (w.phaseTicks === sec(2)) { const b = bots(w).find((p) => p.alive); if (b) kill(m, b, ''); }
      if (w.phaseTicks === sec(4) && me?.inRound && w.round % 2 === 1) kill(m, me, rnd(bots(w)).id);
      if (w.phaseTicks >= sec(7)) {
        const alive = [...w.players.values()].filter((p) => p.inRound && (p.alive || p.respawnIn > 0));
        const winner = w.round % 3 === 0 ? null : w.round % 2 === 0 && me?.alive ? me : alive.find((p) => p.alive) ?? null;
        for (const p of alive) if (p !== winner) { p.respawnIn = 0; kill(m, p, winner?.id ?? ''); }
        w.phase = Phase.RoundOver;
        w.phaseTicks = ROUND_OVER_TIME + sec(1);
        w.winner = winner?.id ?? '';
        if (winner) winner.wins++;
        pushChat({ from: '', name: '@server', text: winner ? `${winner.name} победил` : 'Никто не выиграл', at: Date.now() });
      }
      break;
    }
    case Phase.RoundOver:
      if (--w.phaseTicks <= 0) newRound(m);
      break;
  }
}

// ---------------------------------------------------------------- placeholder "renderer"
function attachPlaceholder(el: HTMLElement, m: Mock) {
  const cv = document.createElement('canvas');
  cv.className = 'stage-placeholder';
  el.appendChild(cv);
  const ctx = cv.getContext('2d')!;
  let raf = 0;
  const draw = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = el.clientWidth, H = el.clientHeight;
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const w = m.world;
    const cell = Math.floor(Math.min(W / (w.width + 2), H / (w.height + 2)));
    const ox = Math.floor((W - cell * w.width) / 2), oy = Math.floor((H - cell * w.height) / 2);
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(ox - cell, oy - cell, cell * (w.width + 2), cell * (w.height + 2));
    for (let y = 0; y < w.height; y++)
      for (let x = 0; x < w.width; x++) {
        const tile = w.tiles[y * w.width + x];
        ctx.fillStyle = tile === Tile.Wall ? '#bdbdbd' : tile === Tile.Brick ? '#c4664a' : (x + y) % 2 ? '#7f9b78' : '#839f7c';
        ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
        if (tile !== Tile.Floor) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(ox + x * cell, oy + (y + 1) * cell - 3, cell, 3); }
      }
    for (const b of m.bombs) {
      ctx.fillStyle = b.t % 20 < 10 ? '#222' : '#444';
      ctx.beginPath(); ctx.arc(ox + (b.x + 0.5) * cell, oy + (b.y + 0.5) * cell, cell * 0.36, 0, Math.PI * 2); ctx.fill();
    }
    let i = 0;
    ctx.textAlign = 'center';
    ctx.font = `${Math.max(9, cell * 0.3)}px BetterVCR, monospace`;
    for (const p of w.players.values()) {
      const c = COLORS[i++ % COLORS.length];
      if (!p.alive) continue;
      const px = ox + (p.x + 0.5) * cell, py = oy + (p.y + 0.5) * cell;
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(px, py, cell * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff2b2b';
      ctx.fillText(p.name, px, py - cell * 0.45);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.font = '10px BetterVCR, monospace';
    ctx.fillText(settings.peek().language === 'ru' ? 'заглушка рендера (mock)' : 'renderer placeholder (mock)', W / 2, oy + cell * w.height + cell * 0.7);
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => { cancelAnimationFrame(raf); cv.remove(); };
}

// ---------------------------------------------------------------- actions
const code = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const mainWorld = (joinNow = false) => startWorld({ bots: 5, online: true, code: 'MAIN', isPrivate: false, join: joinNow });

export function installMockActions() {
  let timer = 0;
  const connecting = (kind: 'quick' | 'private' | 'join', c?: string) => {
    clearTimeout(timer);
    connectStatus.value = { kind, code: c };
    screen.value = 'connecting';
  };
  return bindActions({
    start() { console.info('[ui mock] start'); mainWorld(); },
    play(enabled) {
      console.info('[ui mock] play', enabled);
      if (!mock) mainWorld();
      const m = mock!;
      if (enabled && !m.world.players.has(LOCAL)) join(m);
      if (!enabled) m.world.players.delete(LOCAL);
      hud.value = buildHud(m.world, enabled ? LOCAL : '', m.ping);
    },
    quickPlay() {
      console.info('[ui mock] quickPlay (back to the shared world)');
      connecting('quick');
      timer = window.setTimeout(() => mainWorld(), 700);
    },
    createPrivate() {
      console.info('[ui mock] createPrivate');
      connecting('private');
      const c = code();
      timer = window.setTimeout(() => startWorld({ bots: 3, online: true, code: c, isPrivate: true }), 900);
    },
    joinByCode(c) {
      console.info('[ui mock] joinByCode', c);
      connecting('join', c);
      timer = window.setTimeout(() => {
        if (c === 'XXXX') connectStatus.value = { kind: 'join', code: c, error: t('connect.stub') };
        else startWorld({ bots: 5, online: true, code: c, isPrivate: true });
      }, 900);
    },
    playOffline(o) {
      console.info('[ui mock] playOffline', o);
      startWorld({ bots: o.bots, online: false, code: 'OFFLINE', isPrivate: false, join: true });
    },
    leave() {
      console.info('[ui mock] leave');
      clearTimeout(timer);
      mainWorld();
    },
    sendChat(text) {
      pushChat({ from: LOCAL, name: settings.peek().name, text, at: Date.now() });
    },
    setProfile(p) { console.info('[ui mock] setProfile', p); },
  });
}
