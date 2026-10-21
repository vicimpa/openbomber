// Round weather (Weather in @ob/game), purely visual:
//   rain / storm  slanted streaks with splashes, a darker sky; lightning flashes in a storm
//   snow          drifting pixel flakes (they lag behind the camera a little: depth)
//   fog           big slow banks of mist and a pale haze
//   wind          streaming debris in the theme's colours (leaves, sand, grass bits, powder snow)
//   night         the map goes dark, heroes / bombs / fire glow; fireflies over grass
// One wind per round (direction from the round number, so every client agrees) also drives the
// explosion smoke (Effects.weather).
import { Container, Sprite, Texture } from 'pixi.js';
import { Theme, Weather, type WorldState } from '@ob/game';

import type { ProcTextures } from './textures';

const T = 32;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Wind speed (px/s) per Weather. */
const WIND: Record<Weather, number> = {
  [Weather.Clear]: 10, [Weather.Rain]: 28, [Weather.Storm]: 50, [Weather.Snow]: 16,
  [Weather.Fog]: 5, [Weather.Wind]: 70, [Weather.Night]: 6,
};

/** How the weather treats explosion smoke. */
export interface SmokeWeather { wx: number; wy: number; life: number; alpha: number; tint: number }

const DEBRIS: Record<Theme, number[]> = {
  [Theme.Meadow]: [0x9fbf72, 0x7fa25e, 0xe8e4d0, 0xb7cf84],
  [Theme.Autumn]: [0xd9772b, 0xc4522a, 0xe3a83a, 0xa8452c],
  [Theme.Winter]: [0xf2f6fb, 0xdfe7f1, 0xffffff],
  [Theme.Desert]: [0xd8c08a, 0xc9ad78, 0xe6d3a3],
};

interface Drop { s: Sprite; x: number; y: number; vx: number; vy: number; life: number; age: number; depth: number; spin: number; phase: number }

export class WeatherFx {
  /** Screen layer above the world (rain, snow, fog, wind debris, sky tint, lightning). */
  readonly screen = new Container();
  /** In the map, above heroes and blocks: the night. */
  readonly dark: Sprite;
  /** In the map, above the night (additive): lights of heroes, bombs, fire; fireflies. */
  readonly lights = new Container();

  weather = Weather.Clear;
  theme = Theme.Meadow;
  /** World px/s. */
  wind = { x: 10, y: 0 };
  lowQuality = false;
  /** Called a moment before the thunder of a lightning flash should be heard (storm). */
  onThunder?: (delaySec: number, power: number) => void;

  private sky: Sprite;
  private flash: Sprite;
  private haze: Sprite;
  private drops: Drop[] = [];
  private pool: Sprite[] = [];
  private fogBanks: Drop[] = [];
  private lightPool: Sprite[] = [];
  private lightsUsed = 0;
  private flies: { x: number; y: number; t: number; s: Sprite }[] = [];
  private nextBolt = 0;
  private bolt = 0;
  private time = 0;
  private lastCam = { x: 0, y: 0, ok: false };

  constructor(private tx: ProcTextures) {
    this.sky = new Sprite({ texture: Texture.WHITE, alpha: 0 });
    this.haze = new Sprite({ texture: Texture.WHITE, tint: 0xe8eef4, alpha: 0 });
    this.flash = new Sprite({ texture: Texture.WHITE, alpha: 0 });
    this.dark = new Sprite({ texture: Texture.WHITE, tint: 0x0a0f2c, alpha: 0, visible: false });
    this.lights.blendMode = 'add';
    this.screen.addChild(this.sky, this.haze);
  }

  /** New round: its weather, theme and (from the round number) wind direction. */
  set(world: WorldState) {
    this.weather = world.weather ?? Weather.Clear;
    this.theme = world.theme ?? Theme.Meadow;
    // a steady direction per round, mostly sideways so streaks and smoke read clearly
    const h = Math.sin((world.round + 1) * 12.9898) * 43758.5453;
    const a = (h - Math.floor(h)) * Math.PI * 2;
    const sp = WIND[this.weather];
    this.wind = { x: Math.cos(a) * sp, y: Math.sin(a) * sp * 0.5 };
    for (const d of this.drops) this.free(d.s);
    for (const d of this.fogBanks) d.s.destroy();
    this.drops = []; this.fogBanks = [];
    for (const f of this.flies) f.s.destroy();
    this.flies = [];
    this.nextBolt = rand(3, 7);
    this.bolt = 0;
  }

  smoke(): SmokeWeather {
    const { x: wx, y: wy } = this.wind;
    switch (this.weather) {
      case Weather.Rain: return { wx, wy, life: 0.55, alpha: 0.8, tint: 0xa9a7b6 };
      case Weather.Storm: return { wx, wy, life: 0.45, alpha: 0.75, tint: 0x9d9bac };
      case Weather.Fog: return { wx, wy, life: 1.5, alpha: 1, tint: 0xc6c4cf };
      case Weather.Wind: return { wx, wy, life: 0.8, alpha: 0.9, tint: 0xb8b2c4 };
      case Weather.Night: return { wx, wy, life: 1.1, alpha: 0.8, tint: 0x8c88a0 };
      case Weather.Snow: return { wx, wy, life: 1.2, alpha: 0.9, tint: 0xdde2ec };
      default: return { wx, wy, life: this.theme === Theme.Winter ? 1.2 : 1, alpha: 1, tint: this.theme === Theme.Winter ? 0xdde2ec : 0xb8b2c4 };
    }
  }

  private take(tex: Texture) {
    const s = this.pool.pop() ?? new Sprite({ anchor: 0.5 });
    s.texture = tex;
    s.visible = true;
    this.screen.addChild(s);
    return s;
  }

  private free(s: Sprite) {
    s.removeFromParent();
    this.pool.push(s);
  }

  /**
   * Per frame. `w, h`: screen css px; `camX, camY`: the world root's screen offset (for depth);
   * `world, view` (map-local px) place the night and its lights.
   */
  update(dt: number, w: number, h: number, camX: number, camY: number, zoom: number, world: WorldState | null,
    view: { x0: number; y0: number; x1: number; y1: number } | null) {
    this.time += dt;
    const wx = this.weather;
    const dcx = this.lastCam.ok ? camX - this.lastCam.x : 0, dcy = this.lastCam.ok ? camY - this.lastCam.y : 0;
    this.lastCam = { x: camX, y: camY, ok: true };
    const jump = Math.abs(dcx) > w * 0.5 || Math.abs(dcy) > h * 0.5; // a snap / map change: don't drag everything along

    // sky tint and haze
    const skyA = wx === Weather.Storm ? 0.3 : wx === Weather.Rain ? 0.17 : wx === Weather.Snow ? 0.06 : 0;
    this.sky.tint = wx === Weather.Snow ? 0xc8d4e8 : 0x1a2440;
    this.sky.alpha += (skyA - this.sky.alpha) * Math.min(1, dt * 2);
    this.sky.width = w; this.sky.height = h;
    this.haze.alpha += ((wx === Weather.Fog ? 0.16 : 0) - this.haze.alpha) * Math.min(1, dt * 2);
    this.haze.width = w; this.haze.height = h;

    // falling / flying things
    const area = (w * h) / (1100 * 800);
    const lq = this.lowQuality ? 0.45 : 1;
    const want = Math.round(lq * area * (
      wx === Weather.Rain ? 150 : wx === Weather.Storm ? 260 : wx === Weather.Snow ? 170 : wx === Weather.Wind ? 120 : 0));
    const sw = this.wind.x * zoom, sh = this.wind.y * zoom;
    let spawn = Math.min(want - this.drops.length, Math.ceil(want * dt * 1.2) + 1);
    while (spawn-- > 0) this.spawnDrop(w, h, sw, sh);
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      if (d.age >= d.life || d.x < -40 || d.x > w + 40 || d.y > h + 40 || d.y < -60) {
        if (wx === Weather.Rain || wx === Weather.Storm) this.splash(d.x, d.y, w, h);
        this.free(d.s);
        this.drops[i] = this.drops[this.drops.length - 1];
        this.drops.pop();
        continue;
      }
      if (!jump) { d.x += dcx * d.depth; d.y += dcy * d.depth; }
      d.x += d.vx * dt; d.y += d.vy * dt;
      const s = d.s;
      if (wx === Weather.Snow) {
        s.x = Math.round(d.x + Math.sin(this.time * 1.7 + d.phase) * 6 * d.depth); s.y = Math.round(d.y);
      } else if (wx === Weather.Wind) {
        s.x = Math.round(d.x); s.y = Math.round(d.y + Math.sin(this.time * 5 + d.phase) * 4);
        s.rotation += d.spin * dt;
      } else { s.x = d.x; s.y = d.y; }
      // splash sprites: a short pop
      if (d.spin === -99) { const k = d.age / d.life; s.scale.set(1 + k * 2, 0.5 + k); s.alpha = 0.5 * (1 - k); }
    }

    // fog banks drift across, slowly, a little behind the camera
    if (wx === Weather.Fog) {
      const n = Math.round(lq * 9 * Math.max(1, area));
      while (this.fogBanks.length < n) {
        const s = new Sprite({ texture: this.tx.glow, anchor: 0.5, tint: 0xf2f5f8 });
        const sc = rand(7, 13);
        s.scale.set(sc, sc * 0.55);
        this.screen.addChild(s);
        this.fogBanks.push({ s, x: rand(-100, w + 100), y: rand(-50, h + 50), vx: rand(6, 16) * Math.sign(this.wind.x || 1), vy: rand(-3, 3), life: 1e9, age: 0, depth: rand(0.4, 0.8), spin: 0, phase: rand(0, 6) });
      }
      for (const f of this.fogBanks) {
        if (!jump) { f.x += dcx * f.depth; f.y += dcy * f.depth; }
        f.x += f.vx * dt; f.y += f.vy * dt;
        const span = f.s.width / 2;
        if (f.x > w + span) f.x = -span; else if (f.x < -span) f.x = w + span;
        if (f.y > h + span) f.y = -span * 0.5; else if (f.y < -span) f.y = h + span * 0.5;
        f.s.x = f.x; f.s.y = f.y;
        f.s.alpha = 0.16 + 0.07 * Math.sin(this.time * 0.3 + f.phase);
      }
    } else if (this.fogBanks.length) { for (const f of this.fogBanks) f.s.destroy(); this.fogBanks = []; }

    // lightning
    if (wx === Weather.Storm) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.bolt = 0.45;
        const power = rand(0.5, 1);
        this.nextBolt = rand(6, 14);
        this.onThunder?.(rand(0.3, 1.6), power);
      }
    }
    if (this.bolt > 0) {
      this.bolt -= dt;
      const t = 0.45 - this.bolt;
      // two quick flickers, then a fade
      this.flash.alpha = t < 0.06 ? 0.55 : t < 0.11 ? 0.1 : t < 0.17 ? 0.45 : Math.max(0, 0.45 * (1 - (t - 0.17) / 0.28));
    } else this.flash.alpha = 0;
    this.flash.width = w; this.flash.height = h;
    if (this.flash.alpha > 0 && this.flash.parent !== this.screen) this.screen.addChild(this.flash);
    else if (this.flash.alpha <= 0 && this.flash.parent) this.flash.removeFromParent();

    this.updateNight(dt, world, view);
  }

  private spawnDrop(w: number, h: number, sw: number, sh: number) {
    const wx = this.weather;
    if (wx === Weather.Rain || wx === Weather.Storm) {
      const fall = rand(620, 820), vx = sw * 4 + (wx === Weather.Storm ? 120 : 40) * Math.sign(sw || 1);
      const s = this.take(Texture.WHITE);
      s.tint = 0xcfdcf0;
      s.alpha = rand(0.22, 0.42);
      s.width = 1.5; s.height = rand(9, 16);
      s.rotation = -Math.atan2(vx, fall);
      const life = rand(0.25, 0.9);
      this.drops.push({ s, x: rand(-60, w + 60), y: rand(-40, h * 0.6), vx, vy: fall, life, age: 0, depth: 0, spin: 0, phase: 0 });
    } else if (wx === Weather.Snow) {
      const s = this.take(Texture.WHITE);
      const depth = rand(0.25, 1);
      s.tint = 0xffffff; s.alpha = 0.55 + depth * 0.4; s.rotation = 0;
      s.width = s.height = depth > 0.7 ? 3 : 2;
      this.drops.push({ s, x: rand(-20, w + 20), y: rand(-30, -4), vx: sw * 0.8 * depth, vy: rand(22, 48) * (0.5 + depth), life: 30, age: 0, depth: depth * 0.6, spin: 0, phase: rand(0, 6) });
    } else if (wx === Weather.Wind) {
      const cols = DEBRIS[this.theme];
      const s = this.take(Texture.WHITE);
      const sand = this.theme === Theme.Desert;
      s.tint = cols[Math.floor(Math.random() * cols.length)]!;
      s.alpha = rand(0.6, 0.95);
      s.width = sand ? rand(4, 9) : rand(3, 5); s.height = sand ? 1 : rand(2, 3);
      s.rotation = 0;
      const dir = Math.sign(sw || 1), sp = rand(220, 380);
      const fromLeft = dir > 0;
      this.drops.push({
        s, x: fromLeft ? rand(-30, -4) : rand(w + 4, w + 30), y: rand(0, h), vx: dir * sp, vy: sh * 3 + rand(-20, 20),
        life: 12, age: 0, depth: rand(0.3, 0.8), spin: sand ? 0 : rand(-8, 8), phase: rand(0, 6),
      });
    }
  }

  private splash(x: number, y: number, w: number, h: number) {
    if (this.lowQuality || Math.random() < 0.4 || x < 0 || y < 0 || x > w || y > h) return;
    const s = this.take(Texture.WHITE);
    s.tint = 0xdfe9f7; s.rotation = 0; s.width = 3; s.height = 1;
    this.drops.push({ s, x, y, vx: 0, vy: 0, life: 0.18, age: 0, depth: 0, spin: -99, phase: 0 });
  }

  // ---------------------------------------------------------------- night
  private light(x: number, y: number, r: number, tint: number, alpha: number) {
    let s = this.lightPool[this.lightsUsed];
    if (!s) { s = new Sprite({ texture: this.tx.glow, anchor: 0.5 }); this.lightPool.push(s); this.lights.addChild(s); }
    this.lightsUsed++;
    s.visible = true;
    s.x = x; s.y = y; s.tint = tint; s.alpha = alpha;
    s.scale.set(r / 32);
  }

  private updateNight(dt: number, world: WorldState | null, view: { x0: number; y0: number; x1: number; y1: number } | null) {
    const night = this.weather === Weather.Night;
    const target = night ? 0.58 : 0;
    this.dark.alpha += (target - this.dark.alpha) * Math.min(1, dt * 1.5);
    this.dark.visible = this.dark.alpha > 0.01;
    this.lightsUsed = 0;
    if (this.dark.visible && view) {
      this.dark.x = view.x0 - 64; this.dark.y = view.y0 - 64;
      this.dark.width = view.x1 - view.x0 + 128; this.dark.height = view.y1 - view.y0 + 128;
    }
    if (this.dark.visible && world) {
      const k = this.dark.alpha / 0.58;
      const flick = 0.92 + 0.08 * Math.sin(this.time * 9);
      for (const p of world.players.values()) {
        if (!p.alive || !p.inRound) continue;
        this.light(p.x * T, p.y * T - 4, 70, 0xffd9a0, 0.32 * k);
      }
      for (const b of world.bombs.values()) this.light(b.x * T, b.y * T, 44, 0xff9a50, 0.4 * k * flick);
      for (const f of world.flames.values()) this.light(f.x * T, f.y * T, 60, 0xff8a3a, 0.55 * k * flick);
      // fireflies over grass
      if (this.theme !== Theme.Winter && view && !this.lowQuality) {
        while (this.flies.length < 14) {
          const s = new Sprite({ texture: this.tx.glow, anchor: 0.5, tint: 0xd8ff7a });
          s.scale.set(0.1);
          this.lights.addChild(s);
          this.flies.push({ x: rand(view.x0, view.x1), y: rand(view.y0, view.y1), t: rand(0, 6), s });
        }
        for (const f of this.flies) {
          f.t += dt;
          f.x += Math.sin(f.t * 0.7) * 10 * dt; f.y += Math.cos(f.t * 0.9) * 8 * dt;
          if (f.x < view.x0 - 50 || f.x > view.x1 + 50 || f.y < view.y0 - 50 || f.y > view.y1 + 50) {
            f.x = rand(view.x0, view.x1); f.y = rand(view.y0, view.y1);
          }
          f.s.x = f.x; f.s.y = f.y;
          f.s.alpha = k * Math.max(0, Math.sin(f.t * 2.3)) * 0.9;
        }
      }
    } else if (this.flies.length && !night) { for (const f of this.flies) f.s.destroy(); this.flies = []; }
    for (let i = this.lightsUsed; i < this.lightPool.length; i++) this.lightPool[i].visible = false;
  }

  clear() {
    for (const d of this.drops) this.free(d.s);
    this.drops = [];
  }
}
