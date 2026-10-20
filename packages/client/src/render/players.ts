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

/** Run tags open on a frame that looks like the idle pose: the run loop skips it. */
const RUN_SKIP = 1;
const runLoops = new Map<Texture[], Texture[]>();
function runLoop(frames: Texture[]): Texture[] {
  let loop = runLoops.get(frames);
  if (!loop) { loop = frames.length > RUN_SKIP ? frames.slice(RUN_SKIP) : frames; runLoops.set(frames, loop); }
  return loop;
}

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

  /** Death event: drop the body at once and leave only the ghost of this player's own skin. */
  kill() {
    if (!this.alive) return;
    this.die(this.root.x / T, this.root.y / T);
    this.hold = 0.6;
  }

  private die(x: number, y: number) {
    this.alive = false;
    this.root.visible = false;
    this.tag.visible = false;
    const src = this.a.heroes[this.ownSkin];
    this.fx.death(x, y, (src.IdleDown ?? Object.values(src)[0])[0] ?? Texture.EMPTY);
  }

  update(p: PlayerState, dt: number, local: boolean, fresh: boolean, carriedBomb: boolean) {
    this.time += dt;
    const x = p.x * T, y = p.y * T;
    this.ownSkin = ((p.skin % 11) + 11) % 11;
    if (this.hold > 0) this.hold -= dt;
    if (!p.alive) {
      this.hold = 0;
      if (this.alive && p.inRound && !fresh) this.die(p.x, p.y);
      this.alive = false;
    } else if (!this.alive && (this.hold <= 0 || fresh)) {
      if (!fresh && p.inRound) { this.fx.respawn(p.x, p.y); this.pop = 1; }
      this.alive = true;
      this.hold = 0;
    }
    const visible = p.inRound && this.alive;
    this.root.visible = visible;
    this.tag.visible = visible;
    if (!visible) return;

    this.root.position.set(x, y);
    this.root.zIndex = y;

    // ---- skin + animation tag (Left = mirrored Right)
    const skin = ((p.skin % 11) + 11) % 11;
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
    this.body.scale.set(popS, 2 - popS);
    this.shadow.scale.set(popS);

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

function lerpColor(a: number, b: number, k: number) {
  const ar = a >> 16, ag = (a >> 8) & 255, ab = a & 255;
  const br = b >> 16, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k);
}
