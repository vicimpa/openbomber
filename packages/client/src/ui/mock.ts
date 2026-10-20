// Standalone mock so every screen / HUD element can be seen without the sim, server or renderer.
// `installMockActions()` binds the store actions to a scripted fake match (main.tsx calls it;
// the session layer's bindActions() overrides it). The stage gets a checkerboard placeholder
// canvas with dots for players and the local hero driven by the real InputManager.
import {
  Ability, Button, COUNTDOWN_TIME, CRAZY_TIME, Curse, CURSE_TIME, Dir, FIRE_TIME, GHOST_TIME, Phase,
  type GameEvent, type PlayerState, RESPAWN_DELAY, ROUND_OVER_TIME, ROUND_TIME, sec, SHIELD_TIME,
  SPAWN_INVULNERABLE, TICK_RATE, Tile, type WorldState,
} from '@ob/game';
import { effect } from '@preact/signals';
import type { InputManager } from '$/contracts';
import { createInput } from '$/input';
import { buildHud } from './hud';
import {
  bindActions, connectStatus, fps, handleGameEvents, hud, pushChat, resetGameState, room, screen,
  settings, stage, uiCapturesInput,
} from './store';
import { t } from './i18n';

const LOCAL = 'me';
const BOT_NAMES = ['Бабах', 'Фитиль', 'Сапёр', 'Тротил', 'Пончик', 'Енот', 'Кактус'];
const BOT_LINES = ['gg', 'кто взял пинок?', 'ахаха', 'ну держись 💣', 'лол', 'ещё раунд!', 'кто кинул бомбу через стену??'];
const COLORS = ['#ff8f1f', '#2fd6ff', '#ff3b7f', '#8cff4f', '#ffd23f', '#b47cff', '#ff5a3c', '#46e0b0'];

function makePlayer(id: string, name: string, skin: number, isBot: boolean, x: number, y: number): PlayerState {
  return {
    id, name, skin, isBot, x, y, dir: Dir.Down, moving: false, alive: true, inRound: true, lives: 0,
    bombs: 1, radius: 1, speedLevel: 0, abilities: 0, curse: Curse.None,
    effects: { shield: 0, ghost: 0, crazy: 0, fire: 0, curse: 0, invulnerable: 0, stun: 0 },
    carrying: -1, respawnIn: 0, wins: 0, kills: 0, deaths: 0, ackSeq: 0,
  };
}

function makeWorld(bots: number): WorldState {
  const width = 15, height = 13;
  const tiles = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (x % 2 === 1 && y % 2 === 1) tiles[y * width + x] = Tile.Wall;
      else if (Math.random() < 0.45 && !(x < 3 && y < 3) && !(x > width - 4 && y > height - 4)) tiles[y * width + x] = Tile.Brick;
    }
  const s = settings.peek();
  const players = new Map<string, PlayerState>();
  players.set(LOCAL, makePlayer(LOCAL, s.name, s.skin, false, 0, 0));
  const spawns = [[14, 12], [14, 0], [0, 12], [7, 0], [7, 12], [0, 6], [14, 6]];
  for (let i = 0; i < bots; i++) {
    const [x, y] = spawns[i % spawns.length];
    players.set(`bot${i}`, makePlayer(`bot${i}`, BOT_NAMES[i % BOT_NAMES.length], (s.skin + 1 + i * 2) % 11, true, x, y));
  }
  return {
    tick: 0, seed: 1, phase: Phase.Countdown, phaseTicks: COUNTDOWN_TIME, round: 1, width, height, tiles,
    players, bombs: new Map(), flames: new Map(), pickups: new Map(), falling: [], winner: '', nextId: 1,
  };
}

interface Mock {
  world: WorldState;
  input: InputManager;
  online: boolean;
  ping: number;
  raf: number;
  script: number;           // ticks since phase start (for scripted events)
  prevButtons: number;
  bombs: { x: number; y: number; t: number }[];
  disposers: (() => void)[];
}

let mock: Mock | null = null;

function startMock(opts: { bots: number; online: boolean; code?: string; isPrivate?: boolean }) {
  stopMock();
  resetGameState();
  const world = makeWorld(Math.max(1, Math.min(7, opts.bots)));
  if (opts.online) { world.phase = Phase.Waiting; world.phaseTicks = sec(3); }
  const m: Mock = {
    world, input: createInput(), online: opts.online, ping: opts.online ? 48 : 0, raf: 0, script: 0,
    prevButtons: 0, bombs: [], disposers: [],
  };
  mock = m;
  room.value = { code: opts.code ?? 'OFFL', isPrivate: !!opts.isPrivate, offline: !opts.online };
  screen.value = 'game';
  pushChat({ from: '', name: '', text: opts.online ? `Комната ${opts.code}: добро пожаловать!` : 'Офлайн-матч против ботов (мок)', at: Date.now() });

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
      hud.value = buildHud(m.world, LOCAL, m.ping);
    }
    if (fpsAcc >= 500) { fps.value = Math.round((frames * 1000) / fpsAcc); frames = 0; fpsAcc = 0; }
    m.raf = requestAnimationFrame(frame);
  };
  m.raf = requestAnimationFrame(frame);
  hud.value = buildHud(m.world, LOCAL, m.ping);
}

function stopMock() {
  if (!mock) return;
  cancelAnimationFrame(mock.raf);
  mock.disposers.forEach((d) => d());
  mock.input.dispose();
  mock = null;
}

const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function bots(w: WorldState) { return [...w.players.values()].filter((p) => p.isBot); }

function emit(m: Mock, events: GameEvent[]) { handleGameEvents(events, m.world, LOCAL); }

function kill(m: Mock, victim: PlayerState, killer: string) {
  if (victim.lives > 0) {
    victim.lives--;
    victim.alive = false;
    victim.respawnIn = RESPAWN_DELAY;
  } else {
    victim.alive = false;
  }
  victim.deaths++;
  const k = m.world.players.get(killer);
  if (k && k !== victim) k.kills++;
  emit(m, [{ type: 'playerDied', player: victim.id, killer, x: victim.x, y: victim.y }]);
  if (victim.id === LOCAL) m.input.vibrate([60, 40, 120], 1);
}

function newRound(m: Mock) {
  const w = m.world;
  w.round++;
  w.phase = Phase.Countdown;
  w.phaseTicks = COUNTDOWN_TIME;
  w.winner = '';
  m.script = 0;
  const spectate = w.round % 3 === 0;
  for (const p of w.players.values()) {
    Object.assign(p, {
      alive: true, inRound: true, lives: 0, bombs: 1, radius: 1, speedLevel: 0, abilities: 0, curse: Curse.None,
      carrying: -1, respawnIn: 0,
    });
    for (const k in p.effects) (p.effects as unknown as Record<string, number>)[k] = 0;
    if (p.id === LOCAL) { p.x = 0; p.y = 0; if (spectate) { p.inRound = false; p.alive = false; } }
  }
}

/** One fake tick: phase timers, a scripted sequence of pickups / deaths / chat. */
function step(m: Mock, input: { dx: number; dy: number; buttons: number }) {
  const w = m.world;
  w.tick++;
  m.script++;
  const me = w.players.get(LOCAL)!;
  const T = m.script;

  // local movement for the placeholder
  if (me.alive && w.phase !== Phase.Countdown && w.phase !== Phase.RoundOver) {
    const sp = (2.8 + me.speedLevel * 0.35) / TICK_RATE;
    me.x = Math.max(0, Math.min(w.width - 1, me.x + input.dx * sp));
    me.y = Math.max(0, Math.min(w.height - 1, me.y + input.dy * sp));
    me.moving = !!(input.dx || input.dy);
  }
  const pressed = input.buttons & ~m.prevButtons;
  m.prevButtons = input.buttons;
  if (pressed & Button.Bomb && me.alive) { m.bombs.push({ x: Math.round(me.x), y: Math.round(me.y), t: sec(2.2) }); m.input.vibrate(18, 0.4); }
  if (pressed & Button.Action && me.alive) { me.carrying = me.carrying >= 0 ? -1 : 1; m.input.vibrate(10, 0.3); }
  m.bombs = m.bombs.filter((b) => --b.t > 0);

  // bots wander
  for (const b of bots(w)) {
    if (!b.alive) continue;
    b.x = Math.max(0, Math.min(w.width - 1, b.x + Math.sin((w.tick + b.skin * 40) / 50) * 0.03));
    b.y = Math.max(0, Math.min(w.height - 1, b.y + Math.cos((w.tick + b.skin * 70) / 60) * 0.03));
  }

  // effects tick down
  for (const p of w.players.values()) {
    for (const k in p.effects) {
      const e = p.effects as unknown as Record<string, number>;
      if (e[k] > 0) e[k]--;
    }
    if (p.effects.curse === 0) p.curse = Curse.None;
    if (p.respawnIn > 0 && --p.respawnIn === 0) {
      p.alive = true;
      p.effects.invulnerable = SPAWN_INVULNERABLE;
      emit(m, [{ type: 'playerRespawned', player: p.id, x: p.x, y: p.y }]);
    }
  }

  if (T % sec(9) === 0 && w.phase !== Phase.RoundOver) {
    const b = rnd(bots(w));
    pushChat({ from: b.id, name: b.name, text: rnd(BOT_LINES), at: Date.now() });
  }

  switch (w.phase) {
    case Phase.Waiting:
      if (--w.phaseTicks <= 0) { w.phase = Phase.Countdown; w.phaseTicks = COUNTDOWN_TIME; m.script = 0; }
      break;
    case Phase.Countdown:
      if (--w.phaseTicks <= 0) {
        w.phase = Phase.Playing;
        w.phaseTicks = ROUND_TIME - sec(26); // fast-forward so sudden death comes quickly
        m.script = 0;
      }
      break;
    case Phase.Playing: {
      w.phaseTicks++;
      const script: Record<number, () => void> = {
        [sec(1.5)]: () => { me.bombs = 2; },
        [sec(3)]: () => { me.radius = 3; me.speedLevel = 1; },
        [sec(4.5)]: () => { me.abilities |= Ability.Kick; },
        [sec(6)]: () => { me.effects.shield = SHIELD_TIME; },
        [sec(7.5)]: () => { me.abilities |= Ability.Glove | Ability.Remote; me.bombs = 4; },
        [sec(9)]: () => { me.lives = 1; me.effects.ghost = GHOST_TIME; },
        [sec(10.5)]: () => {
          me.curse = rnd([Curse.Reverse, Curse.Diarrhea, Curse.Slow, Curse.TinyFlame]); me.effects.curse = CURSE_TIME;
          emit(m, [{ type: 'curseApplied', player: LOCAL, curse: me.curse, from: 'bot0' }]);
        },
        [sec(12)]: () => { const b = bots(w)[0]; if (b) kill(m, b, LOCAL); },
        [sec(13.5)]: () => { me.effects.crazy = CRAZY_TIME; me.abilities |= Ability.Pierce; },
        [sec(15)]: () => { const bs = bots(w); if (bs[1]) kill(m, bs[1], bs[2]?.id ?? bs[1].id); },
        [sec(17)]: () => { me.effects.fire = FIRE_TIME; me.abilities |= Ability.Punch | Ability.LineBomb | Ability.BombPass; },
        [sec(19)]: () => { const bs = bots(w); if (bs[2]) kill(m, bs[2], bs[2].id); },
      };
      if (me.inRound) script[T]?.();
      if (w.phaseTicks >= ROUND_TIME) { w.phase = Phase.SuddenDeath; w.phaseTicks = 0; m.script = 0; emit(m, [{ type: 'suddenDeath' }]); }
      break;
    }
    case Phase.SuddenDeath: {
      w.phaseTicks++;
      if (T === sec(2) && me.alive && me.inRound) kill(m, me, rnd(bots(w)).id);
      if (T === sec(4)) { const b = bots(w).find((p) => p.alive); if (b) kill(m, b, ''); }
      if (T === sec(6) && w.round % 2 === 1 && me.alive && me.inRound) kill(m, me, me.id);
      if (T >= sec(9)) {
        const alive = [...w.players.values()].filter((p) => p.inRound && (p.alive || p.respawnIn > 0));
        for (const p of alive) if (p !== alive[0] && alive.length > 1) { kill(m, p, alive[0].id); p.respawnIn = 0; }
        const winner = w.round % 2 === 0 && me.inRound ? me : alive.find((p) => p.alive) ?? null;
        w.phase = Phase.RoundOver;
        w.phaseTicks = ROUND_OVER_TIME + sec(2);
        w.winner = w.round % 4 === 3 ? '' : winner?.id ?? '';
        const wp = w.players.get(w.winner);
        if (wp) wp.wins++;
        m.script = 0;
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
    const w = m.world;
    ctx.fillStyle = '#0b0a16';
    ctx.fillRect(0, 0, W, H);
    const cell = Math.floor(Math.min((W - 24) / w.width, (H - 24) / w.height));
    const ox = Math.floor((W - cell * w.width) / 2), oy = Math.floor((H - cell * w.height) / 2);
    for (let y = 0; y < w.height; y++)
      for (let x = 0; x < w.width; x++) {
        const tile = w.tiles[y * w.width + x];
        ctx.fillStyle = tile === Tile.Wall ? '#2b2747' : tile === Tile.Brick ? '#3a2a2a' : (x + y) % 2 ? '#15132a' : '#1a1833';
        ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    for (const b of m.bombs) {
      ctx.fillStyle = b.t % 20 < 10 ? '#222' : '#444';
      ctx.beginPath(); ctx.arc(ox + (b.x + 0.5) * cell, oy + (b.y + 0.5) * cell, cell * 0.36, 0, Math.PI * 2); ctx.fill();
    }
    let i = 0;
    for (const p of w.players.values()) {
      const c = COLORS[i++ % COLORS.length];
      if (!p.alive) continue;
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(ox + (p.x + 0.5) * cell, oy + (p.y + 0.5) * cell, cell * (p.id === LOCAL ? 0.32 : 0.26), 0, Math.PI * 2); ctx.fill();
      if (p.id === LOCAL) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '12px Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(settings.peek().language === 'ru' ? 'Заглушка рендера (mock)' : 'Renderer placeholder (mock)', W / 2, H - 8);
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => { cancelAnimationFrame(raf); cv.remove(); };
}

// ---------------------------------------------------------------- actions
const code = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

export function installMockActions() {
  let timer = 0;
  const connecting = (kind: 'quick' | 'private' | 'join', c?: string) => {
    clearTimeout(timer);
    connectStatus.value = { kind, code: c };
    screen.value = 'connecting';
  };
  return bindActions({
    quickPlay() {
      console.info('[ui mock] quickPlay');
      connecting('quick');
      timer = window.setTimeout(() => { connectStatus.value = { kind: 'quick', error: t('connect.stub') }; }, 1600);
    },
    createPrivate() {
      console.info('[ui mock] createPrivate');
      connecting('private');
      const c = code();
      timer = window.setTimeout(() => startMock({ bots: 3, online: true, code: c, isPrivate: true }), 900);
    },
    joinByCode(c) {
      console.info('[ui mock] joinByCode', c);
      connecting('join', c);
      timer = window.setTimeout(() => startMock({ bots: 5, online: true, code: c, isPrivate: true }), 900);
    },
    playOffline(o) {
      console.info('[ui mock] playOffline', o);
      startMock({ bots: o.bots, online: false });
    },
    leave() {
      console.info('[ui mock] leave');
      clearTimeout(timer);
      stopMock();
      resetGameState();
      screen.value = 'menu';
    },
    sendChat(text) {
      pushChat({ from: LOCAL, name: settings.peek().name, text, at: Date.now() });
    },
    setProfile(p) { console.info('[ui mock] setProfile', p); },
  });
}
