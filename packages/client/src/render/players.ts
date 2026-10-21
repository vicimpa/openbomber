// Player views: hero skins with idle/run/carry animations, status overlays, name tags.
import { BitmapText, Container, Sprite, Texture } from 'pixi.js';
import { Ability, BASE_SPEED, Curse, Dir, SPEED_STEP, TICK_RATE, type PlayerState } from '@ob/game';

import { Anim } from './anim';
import type { GameAssets } from './assets';
import type { Effects } from './fx';
import type { ProcTextures } from './textures';
import { FONT_TAG } from './text';

const T = 32;
const DIR_NAME: Record<Dir, string> = { [Dir.Up]: 'Up', [Dir.Left]: 'Right', [Dir.Right]: 'Right', [Dir.Down]: 'Down' };
const BLINK_WARN = TICK_RATE * 2; // timed effects blink during their last 2 s
/** Spawn animation: a beam of light, the hero drops in, lands with a squash and a dust ring. */
const SPAWN_DROP = 0.2;   // s, falling
const SPAWN_LEN = 0.5;    // s, whole animation
const SPAWN_HEIGHT = 72;  // px above the ground at the start

/** Run tags open on a frame that looks like the idle pose: the run loop skips it. */
const RUN_SKIP = 1;
const runLoops = new Map<Texture[], Texture[]>();
function runLoop(frames: Texture[]): Texture[] {
  let loop = runLoops.get(frames);
  if (!loop) { loop = frames.length > RUN_SKIP ? frames.slice(RUN_SKIP) : frames; runLoops.set(frames, loop); }
  return loop;
}

/** A still copy of a hero (frozen old arena / leaving): its own sprites plus how it was moving. */
export interface Frozen { c: Container; body: Sprite; frames: Texture[]; fps: number; t: number; vx: number; vy: number }

export class PlayerView {
  readonly root = new Container();
  private shadow: Sprite;
  private upper = new Container({ y: -8 });
  private body = new Container();
  private hero: Anim;
  private shieldBack: Anim; private shieldFront: Anim;
  private fireBack: Anim; private fireFront: Anim;
  private dustBack = new Sprite({ anchor: 0.5 });
  private dustFront = new Sprite({ anchor: 0.5 });
  private crazy: Anim;
  private kicking: Anim;
  private stars = new Container({ y: -30 });
  private skull: Sprite;
  readonly tag: Container;
  private name: BitmapText;
  private marker: Sprite;

  private tagName = '';
  private skin = -1;
  private ownSkin = 0;
  private time = Math.random() * 10;
  /** Whether the body is shown (false from the death event/state until a real respawn). */
  private alive = false;
  /** After a death event: ignore stale alive=true states for a moment (online patches lag events). */
  private hold = 0;
  private pop = 0;
  /** Spawn animation clock (s): < 0 waiting (hidden), 0..SPAWN_LEN playing, NaN idle. */
  private spawnT = NaN;
  private spawnSound = false;
  /** Teleport: stay hidden until the (possibly interpolated) position has really arrived here. */
  private arrive: { x: number; y: number; t: number } | null = null;
  /** Smoothed on-screen velocity (px/s) and the last position, for frozen copies that keep running. */
  private vx = 0; private vy = 0; private lx = NaN; private ly = NaN;
  private dustT = 0;
  seen = true;

  constructor(private a: GameAssets, tx: ProcTextures, private fx: Effects) {
    this.shadow = new Sprite({ texture: tx.shadow, anchor: 0.5, y: 6 });
    this.hero = new Anim([], 4);
    this.shieldBack = new Anim(a.shield.back, 14);
    this.shieldFront = new Anim(a.shield.front, 14);
    this.fireBack = new Anim(a.fxFire.back, 16);
    this.fireFront = new Anim(a.fxFire.front, 16);
    this.crazy = new Anim(a.crazy, 10, { scale: 2 });
    this.kicking = new Anim(a.kicking, 6, { scale: 2 });
    this.body.addChild(this.shieldBack, this.fireBack, this.dustBack, this.hero, this.dustFront, this.fireFront, this.shieldFront, this.crazy, this.kicking);
    this.upper.addChild(this.body);
    for (let i = 0; i < 3; i++) this.stars.addChild(new Sprite({ texture: tx.star, anchor: 0.5 }));
    this.skull = new Sprite({ texture: tx.skull, anchor: 0.5, y: -34 });
    this.root.addChild(this.shadow, this.upper, this.stars, this.skull);

    this.tag = new Container();
    this.name = new BitmapText({ text: '', style: { fontFamily: FONT_TAG, fontSize: 8 }, anchor: { x: 0.5, y: 1 } });
    this.marker = new Sprite({ texture: tx.marker, anchor: { x: 0.5, y: 1 } });
    this.tag.addChild(this.name, this.marker);
  }

  /** On screen right now (alive, in the round, not waiting to drop in). */
  get shown() { return this.root.visible && this.alive; }

  /** A still copy of the hero as it looks right now (shadow + body), for the frozen old arena. */
  freeze(): Frozen | null {
    if (!this.root.visible || !this.alive) return null;
    const c = new Container({ x: this.root.x, y: this.root.y });
    c.addChild(new Sprite({ texture: this.shadow.texture, anchor: 0.5, y: this.shadow.y, scale: this.shadow.scale, alpha: this.shadow.alpha }));
    const body = new Sprite({
      texture: this.hero.texture, anchor: 0.5, y: this.upper.y + this.body.y, tint: this.hero.tint, alpha: this.upper.alpha,
      scale: { x: this.hero.scale.x * this.body.scale.x, y: this.body.scale.y },
    });
    body.label = 'body';
    c.addChild(body);
    return { c, body, frames: this.hero.frames, fps: this.hero.fps, t: this.hero.time, vx: this.vx, vy: this.vy };
  }

  /** Death event: drop the body at once and leave only the ghost of this player's own skin. */
  kill(cause?: string, from?: { x: number; y: number } | null) {
    if (!this.alive) return;
    this.die(this.root.x / T, this.root.y / T, cause, from);
    this.hold = 0.6;
  }

  private die(x: number, y: number, cause?: string, from?: { x: number; y: number } | null) {
    this.alive = false;
    this.root.visible = false;
    this.tag.visible = false;
    const src = this.a.heroes[this.ownSkin];
    const ghost = (src.IdleDown ?? Object.values(src)[0])[0] ?? Texture.EMPTY;
    if (cause === 'fire' && this.hero.texture !== Texture.EMPTY) {
      // knocked away from the burning player who touched us
      const dx = from ? Math.sign(Math.round((x - from.x) * 4)) : 0;
      this.fx.burnDeath(x, y, this.hero.texture, this.hero.scale.x, ghost, dx);
    } else this.fx.death(x, y, ghost);
  }

  /** Play the spawn animation after `delay` seconds (hidden until then). */
  spawn(delay = 0, sound = false) {
    this.spawnT = -Math.max(0, delay);
    this.spawnSound = sound;
    this.pop = 0;
  }

  /** Teleported to tile (x, y): drop in there (no sliding across the map). */
  teleportIn(x: number, y: number) {
    this.spawn(0.08, true);
    this.arrive = { x: x * T, y: y * T, t: 0.6 };
  }

  /** `spawnDelay` >= 0: on a fresh map, drop in after that many seconds (negative: just appear). */
  update(p: PlayerState, dt: number, local: boolean, fresh: boolean, carriedBomb: boolean, spawnDelay = -1) {
    this.time += dt;
    const x = p.x * T, y = p.y * T;
    this.ownSkin = wrapSkin(p.skin, this.a.heroes.length);
    if (this.hold > 0) this.hold -= dt;
    if (!p.alive) {
      this.hold = 0;
      if (this.alive && p.inRound && !fresh) this.die(p.x, p.y);
      this.alive = false;
    } else if (!this.alive && (this.hold <= 0 || fresh)) {
      if (!fresh && p.inRound) this.spawn(0);
      this.alive = true;
      this.hold = 0;
    }
    if (fresh && p.alive && p.inRound) {
      if (spawnDelay >= 0) this.spawn(spawnDelay, true); else { this.spawnT = NaN; this.tag.alpha = 1; }
    }
    const visible = p.inRound && this.alive;
    this.root.visible = visible;
    this.tag.visible = visible;
    if (!visible) { this.spawnT = NaN; this.tag.alpha = 1; return; }

    // smoothed velocity (online positions are interpolated per frame, offline per tick)
    if (dt > 0 && this.lx === this.lx) {
      const k = 1 - Math.exp(-dt * 10);
      const mv = p.moving && p.effects.stun <= 0;
      this.vx += ((mv ? (x - this.lx) / dt : 0) - this.vx) * k;
      this.vy += ((mv ? (y - this.ly) / dt : 0) - this.vy) * k;
      if (Math.hypot(x - this.lx, y - this.ly) > T * 2) { this.vx = 0; this.vy = 0; } // teleported / respawned
    }
    this.lx = x; this.ly = y;
    this.root.position.set(x, y);
    this.root.zIndex = y;

    // ---- spawn: wait (hidden) → beam + drop → landing squash
    let dropY = 0, sx = 1, sy = 1, shadowK = 1;
    if (this.arrive) {
      this.arrive.t -= dt;
      if (this.arrive.t > 0 && Math.hypot(x - this.arrive.x, y - this.arrive.y) > T * 0.6) {
        this.root.visible = false; this.tag.visible = false; return;
      }
      this.arrive = null;
    }
    if (this.spawnT === this.spawnT) {
      const t0 = this.spawnT;
      this.spawnT += dt;
      const t = this.spawnT;
      if (t < 0) { this.root.visible = false; this.tag.visible = false; return; }
      if (t0 <= 0 && t > 0) {
        this.fx.spawnBeam(p.x, p.y);
        if (this.spawnSound) this.fx.sound?.('dropIn', p.x, p.y, p.id);
      }
      if (t0 < SPAWN_DROP && t >= SPAWN_DROP) this.fx.spawnLand(p.x, p.y);
      if (t < SPAWN_DROP) {
        const k = t / SPAWN_DROP;
        dropY = -SPAWN_HEIGHT * (1 - k * k);
        sx = 0.8; sy = 1.3;
        shadowK = 0.35 + 0.65 * k;
        this.tag.visible = false;
      } else {
        const k = Math.min(1, (t - SPAWN_DROP) / (SPAWN_LEN - SPAWN_DROP));
        const sq = Math.sin(k * Math.PI * 2.2) * (1 - k) ** 1.5;
        sx = 1 + 0.38 * sq; sy = 1 - 0.32 * sq;
        this.tag.alpha = Math.min(1, k * 2.5);
      }
      if (t >= SPAWN_LEN) { this.spawnT = NaN; this.tag.alpha = 1; }
    }

    // ---- skin + animation tag (Left = mirrored Right)
    const skin = wrapSkin(p.skin, this.a.heroes.length);
    const src = this.a.heroes[skin];
    const moving = p.moving && p.effects.stun <= 0;
    const tagName = `${moving ? 'Run' : 'Idle'}${DIR_NAME[p.dir]}${carriedBomb ? 'Bomb' : ''}`;
    const speed = (BASE_SPEED + SPEED_STEP * p.speedLevel) / BASE_SPEED * (p.effects.fire > 0 ? 0.6 : 1)
      * (p.curse === Curse.Slow ? 0.6 : p.curse === Curse.Fast ? 1.5 : 1);
    this.hero.fps = moving ? 12 * speed : 4; // before setFrames: a restart is timed in the new rate
    if (tagName !== this.tagName || skin !== this.skin) {
      const sameKind = this.tagName.startsWith(moving ? 'Run' : 'Idle');
      const frames = src[tagName] ?? src.IdleDown;
      this.hero.setFrames(moving ? runLoop(frames) : frames, sameKind ? -1 : 0);
      this.tagName = tagName; this.skin = skin;
    }
    this.hero.tick(dt);
    const flip = p.dir === Dir.Left ? -1 : 1;
    this.hero.scale.x = flip;
    this.dustBack.scale.x = flip;
    this.dustFront.scale.x = flip;

    // ---- SpeedUp dust (frame-matched front/back layers)
    const fast = p.speedLevel > 0 || p.curse === Curse.Fast;
    this.dustBack.visible = this.dustFront.visible = fast;
    if (fast) {
      const f = this.hero.frame + (moving ? RUN_SKIP : 0); // dust frames follow the full Run tag
      this.dustBack.texture = this.a.dust['back' + this.tagName]?.[f] ?? Texture.EMPTY;
      this.dustFront.texture = this.a.dust['front' + this.tagName]?.[f] ?? Texture.EMPTY;
      if (moving && p.speedLevel >= 2 && !this.fx.lowQuality) {
        this.dustT -= dt;
        if (this.dustT <= 0) { this.dustT = 0.12 - p.speedLevel * 0.012; this.fx.footDust(x, y + 7); }
      }
    }

    // ---- timed overlays
    const warn = (ticks: number) => ticks > 0 && (ticks > BLINK_WARN || Math.floor(this.time * 8) % 2 === 0);
    const shield = warn(p.effects.shield), fire = warn(p.effects.fire);
    this.shieldBack.visible = this.shieldFront.visible = shield;
    this.fireBack.visible = this.fireFront.visible = fire;
    this.crazy.visible = p.effects.crazy > 0;
    // abilities are timed in v2 (effects.kick etc. when present): blink the overlay before it runs out
    const kickLeft = (p.effects as unknown as Record<string, number | undefined>).kick;
    this.kicking.visible = (p.abilities & Ability.Kick) !== 0 && (kickLeft === undefined || warn(kickLeft) || kickLeft <= 0);
    this.shieldBack.tick(dt); this.shieldFront.tick(dt);
    this.fireBack.tick(dt); this.fireFront.tick(dt);
    this.crazy.tick(dt); this.kicking.tick(dt);

    // ---- ghost / curse tint / invulnerability blink
    const ghost = p.effects.ghost > 0;
    let alpha = 1;
    if (ghost) alpha = warn(p.effects.ghost) ? 0.45 + 0.1 * Math.sin(this.time * 6) : 0.8;
    if (p.effects.invulnerable > 0 && Math.floor(this.time * 12) % 2 === 0) alpha *= 0.3;
    if (this.spawnT === this.spawnT && this.spawnT < SPAWN_DROP) alpha *= Math.min(1, this.spawnT / SPAWN_DROP * 3);
    this.upper.alpha = alpha;
    this.shadow.alpha = ghost ? 0.5 : 1;
    let tint = 0xffffff;
    if (ghost) tint = 0xc8dcff;
    const cursed = p.curse !== Curse.None && p.effects.curse > 0;
    if (cursed) {
      const k = (Math.sin(this.time * 7) + 1) / 2;
      tint = lerpColor(0xffffff, Math.floor(this.time * 1.5) % 2 ? 0xb88cff : 0x9cff9c, 0.35 + 0.35 * k);
    }
    this.hero.tint = tint;
    this.skull.visible = cursed;
    if (cursed) {
      this.skull.y = -36 + Math.round(Math.sin(this.time * 4) * 1.5);
      this.skull.rotation = Math.sin(this.time * 3) * 0.15;
    }

    // ---- stun: orbiting stars + wobble
    const stunned = p.effects.stun > 0;
    this.stars.visible = stunned;
    this.upper.rotation = stunned ? Math.sin(this.time * 18) * 0.08 : 0;
    if (stunned) {
      this.stars.children.forEach((s, i) => {
        const a = this.time * 5 + (i * Math.PI * 2) / 3;
        s.x = Math.cos(a) * 10; s.y = Math.sin(a) * 3.5;
        s.scale.set(Math.sin(a) > 0 ? 1 : 0.7);
        s.alpha = Math.sin(a) > 0 ? 1 : 0.6;
      });
    }

    // ---- spawn pop + idle breathing
    if (this.pop > 0) this.pop = Math.max(0, this.pop - dt * 3);
    const popS = this.pop > 0 ? 1 + Math.sin(this.pop * Math.PI) * 0.35 : 1;
    this.body.scale.set(popS * sx, (2 - popS) * sy);
    this.body.y = Math.round(dropY + 12 * (1 - sy)); // squash around the feet
    this.shadow.scale.set(popS * shadowK);
    this.shadow.alpha *= shadowK;

    // ---- name tag (separate layer, always on top)
    const ny = y - (cursed ? 46 : 36);
    this.tag.position.set(x, ny);
    if (this.name.text !== p.name) this.name.text = p.name;
    // canon: red nick above the hero
    this.name.tint = local ? 0xff5a4a : 0xe8423a;
    this.name.alpha = local ? 1 : 0.9;
    this.marker.visible = local;
    if (local) this.marker.y = -11 - Math.round(Math.abs(Math.sin(this.time * 4)) * 3);
  }

  destroy() {
    this.root.destroy({ children: true });
    this.tag.destroy({ children: true });
  }
}

/** Any skin index onto the loaded hero sheets (an older client / bad input never gets an empty sprite). */
function wrapSkin(skin: number, n: number) {
  return ((skin % n) + n) % n;
}

function lerpColor(a: number, b: number, k: number) {
  const ar = a >> 16, ag = (a >> 8) & 255, ab = a & 255;
  const br = b >> 16, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k);
}
