// Pixi.js v8 renderer for WorldState. See contracts.ts (GameRenderer / CreateRenderer).
import { Application, Container, Sprite, Texture } from 'pixi.js';
import { Phase, PickupType, type BombState, type GameEvent, type WorldState } from '@ob/game';

import type { CreateRenderer, GameRenderer, RendererOptions } from '../contracts';
import { Arena } from './arena';
import { loadAssets, type GameAssets } from './assets';
import { Camera, type CameraMode, type CameraView } from './camera';
import { Effects } from './fx';
import { Ground, makeGroundPattern } from './ground';
import { BombView, FlameView, PickupView } from './items';
import { PlayerView } from './players';
import { installFonts } from './text';
import { makeTextures, type ProcTextures } from './textures';

const T = 32;
const MAX_DPR = 2;

const PICKUP_LABEL: Record<PickupType, [string, number]> = {
  [PickupType.BombUp]: ['+1 BOMB', 0x8fe3ff], [PickupType.FireUp]: ['+1 FIRE', 0xffb35c],
  [PickupType.SpeedUp]: ['SPEED UP', 0x8dffb0], [PickupType.FullFire]: ['MAX FIRE!', 0xffd84a],
  [PickupType.Kick]: ['KICK', 0xffffff], [PickupType.Glove]: ['GLOVE', 0xffffff], [PickupType.Punch]: ['PUNCH', 0xffffff],
  [PickupType.Remote]: ['REMOTE', 0xffffff], [PickupType.Pierce]: ['PIERCE', 0xffb35c], [PickupType.LineBomb]: ['LINE BOMB', 0xffffff],
  [PickupType.BombPass]: ['BOMB PASS', 0xffffff], [PickupType.Shield]: ['SHIELD', 0x9fe6ff], [PickupType.Ghost]: ['GHOST', 0xd8e4ff],
  [PickupType.Crazy]: ['CRAZY BOMBS', 0xff7ad0], [PickupType.Fire]: ['ON FIRE!', 0xff8a4a], [PickupType.Heart]: ['+1 LIFE', 0xff7a8a],
  [PickupType.Skull]: ['CURSED!', 0xc58cff], [PickupType.Random]: ['???', 0xffffff],
};

interface Known { x: number; y: number; t: number }

class PixiRenderer implements GameRenderer {
  private view: CameraView = { cssW: 1, cssH: 1, res: 1 };
  private camera = new Camera();
  private worldRoot = new Container();
  private arena: Arena;
  private ground: Ground;
  private fx: Effects;
  private pickupLayer = new Container();
  private flameLayer = new Container();
  private flameGlow = new Container();
  private entities = new Container({ sortableChildren: true });
  private tags = new Container();
  private overlay = new Container();
  private vignette: Sprite;
  private flashRect: Sprite;

  private players = new Map<string, PlayerView>();
  private bombs = new Map<number, BombView>();
  private pickups = new Map<number, PickupView>();
  private flames = new Map<number, FlameView>();
  /** Last known positions of entities that may already be gone when their event arrives. */
  private lastPickup = new Map<number, Known & { type: PickupType }>();
  private lastBomb = new Map<number, Known>();
  private flameCenters = new Map<number, { x: number; y: number; dist: number; t: number }>();

  private world: WorldState | null = null;
  private camMode: CameraMode = 'follow';
  private meAlive = false;
  private tightUntil = 0;
  private recentBooms: { x: number; y: number; t: number }[] = [];
  private localId = '';
  private time = 0;
  private flash = 0;
  private flashColor = 0xffffff;
  private sdPulse = 0;
  private ro: ResizeObserver;

  constructor(private app: Application, private parent: HTMLElement, private a: GameAssets, private tx: ProcTextures, quality: 'low' | 'high') {
    this.fx = new Effects(a, tx);
    this.ground = new Ground(makeGroundPattern(a.world.grass, a.world.grass2, a.terrain));
    this.arena = new Arena(a, tx, this.fx);
    this.arena.onImpact = (x, y) => this.shakeAt(x, y, 0.8);
    this.flameGlow.blendMode = 'add';
    this.worldRoot.addChild(
      this.ground.sprite, this.arena.root, this.arena.zoneLayer, this.fx.under, this.arena.fallingShadows, this.pickupLayer, this.flameLayer,
      this.flameGlow, this.entities, this.fx.particles.normal, this.arena.fallingRoot, this.fx.over,
      this.fx.particles.additive, this.fx.light, this.tags,
    );
    this.arena.fallingRoot.sortableChildren = true;
    this.vignette = new Sprite({ texture: tx.vignette, tint: 0xff1a2a, alpha: 0 });
    this.flashRect = new Sprite({ texture: Texture.WHITE, alpha: 0 });
    this.overlay.addChild(this.vignette, this.flashRect);
    app.stage.addChild(this.worldRoot, this.overlay);
    this.setQuality(quality);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(parent);
    this.resize();
  }

  private resize() {
    const r = this.parent.getBoundingClientRect();
    const res = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === this.view.cssW && h === this.view.cssH && res === this.view.res) return;
    this.view = { cssW: w, cssH: h, res };
    this.app.renderer.resize(w, h, res);
    this.vignette.width = w; this.vignette.height = h;
    this.flashRect.width = w; this.flashRect.height = h;
  }

  setQuality(q: 'low' | 'high') {
    this.fx.lowQuality = q === 'low';
    this.fx.particles.max = q === 'low' ? 350 : 1400;
    this.flameGlow.visible = q === 'high';
  }

  // ---------------------------------------------------------------- frame
  render(world: WorldState | null, localId: string, dtMs: number) {
    const dt = Math.min(0.1, Math.max(0, dtMs / 1000));
    this.time += dt;
    this.world = world;
    this.localId = localId;
    if (!world) {
      this.worldRoot.visible = false;
      this.updateOverlay(dt, null);
      this.app.render();
      return;
    }
    this.worldRoot.visible = true;

    const fresh = this.arena.sync(world, dt);
    if (fresh) this.onNewMap();

    this.syncPlayers(world, dt, fresh);
    this.syncBombs(world, dt);
    this.syncPickups(world, dt);
    this.syncFlames(world, dt);
    this.fx.update(dt);
    this.gc();

    this.updateCamera(world, localId, dt);
    this.camera.apply(this.worldRoot, this.view);
    // visible world rect → endless ground + chunk culling
    const sc = this.worldRoot.scale.x, ox = this.worldRoot.x, oy = this.worldRoot.y;
    const x0 = -ox / sc, y0 = -oy / sc, x1 = (this.view.cssW - ox) / sc, y1 = (this.view.cssH - oy) / sc;
    this.ground.cover(x0, y0, x1, y1);
    this.arena.cull(x0 - T, y0 - T, x1 + T, y1 + T, this.camera.zoom);
    this.updateOverlay(dt, world);
    this.app.render();
  }

  /** Optional extra beyond GameRenderer: 'follow' (default), 'overview' or 'attract' (menu backdrop). */
  setCameraMode(mode: CameraMode) {
    if (this.camMode === mode) return;
    this.camMode = mode;
  }

  private updateCamera(world: WorldState, localId: string, dt: number) {
    const me = localId ? world.players.get(localId) : undefined;
    const playing = !!me && me.alive && me.inRound && world.phase !== Phase.RoundOver;
    if (playing && !this.meAlive) this.tightUntil = this.time + 1.4; // just (re)spawned: zoom in
    this.meAlive = playing;
    let mode: CameraMode = this.camMode;
    if (mode === 'follow' && !playing) mode = 'overview';
    this.camera.mode = mode;
    let interest: { x: number; y: number }[] = [];
    if (mode === 'attract') {
      for (const p of world.players.values()) if (p.alive && p.inRound) interest.push(p);
      const recent = this.recentBooms.filter(b => this.time - b.t < 3);
      if (recent.length) interest = interest.concat(recent, recent); // explosions weigh double
    }
    this.camera.update(dt, this.view, {
      aw: world.width, ah: world.height,
      focus: playing ? { x: me!.x, y: me!.y } : null,
      tight: world.phase === Phase.Countdown || this.time < this.tightUntil,
      interest,
    });
  }

  private onNewMap() {
    for (const v of this.bombs.values()) v.destroy();
    for (const v of this.pickups.values()) v.destroy();
    for (const v of this.flames.values()) v.destroy();
    this.bombs.clear(); this.pickups.clear(); this.flames.clear();
    this.fx.clear();
    this.camera.reset();
  }

  private syncPlayers(world: WorldState, dt: number, fresh: boolean) {
    for (const v of this.players.values()) v.seen = false;
    const carried = new Set<number>();
    for (const b of world.bombs.values()) if (b.motion === 3) carried.add(b.id);
    for (const p of world.players.values()) {
      let v = this.players.get(p.id);
      if (!v) {
        v = new PlayerView(this.a, this.tx, this.fx);
        this.players.set(p.id, v);
        this.entities.addChild(v.root);
        this.tags.addChild(v.tag);
        v.update(p, 0, p.id === this.localId, true, false);
      }
      v.seen = true;
      v.update(p, dt, p.id === this.localId, fresh, p.carrying >= 0 && carried.has(p.carrying));
    }
    for (const [id, v] of this.players) if (!v.seen) { v.destroy(); this.players.delete(id); }
    // local tag on top of the others
    const me = this.players.get(this.localId);
    if (me && me.tag.parent === this.tags && this.tags.children[this.tags.children.length - 1] !== me.tag) this.tags.addChild(me.tag);
  }

  private syncBombs(world: WorldState, dt: number) {
    for (const v of this.bombs.values()) v.seen = false;
    let holders: Map<number, { x: number; y: number }> | null = null;
    for (const b of world.bombs.values()) {
      let v = this.bombs.get(b.id);
      if (!v && b.id >= 0) v = this.adoptPredicted(b);
      if (!v) {
        v = new BombView(this.a, this.tx, this.fx, b);
        this.bombs.set(b.id, v);
        this.entities.addChild(v.root);
      }
      v.seen = true;
      let holder: { x: number; y: number } | null = null;
      if (b.motion === 3) {
        if (!holders) {
          holders = new Map();
          for (const p of world.players.values()) if (p.carrying >= 0) holders.set(p.carrying, p);
        }
        holder = holders.get(b.id) ?? null;
      }
      v.update(b, dt, holder, world.width, world.height);
      this.lastBomb.set(b.id, { x: v.x, y: v.y, t: this.time });
    }
    for (const [id, v] of this.bombs) if (!v.seen) { v.destroy(); this.bombs.delete(id); }
  }

  /** A predicted local bomb (negative id) turned into the server's one: keep its view (no second pop). */
  private adoptPredicted(b: BombState): BombView | undefined {
    const x = Math.round(b.x), y = Math.round(b.y);
    for (const [id, v] of this.bombs) {
      if (id >= 0 || Math.round(v.x) !== x || Math.round(v.y) !== y) continue;
      this.bombs.delete(id);
      this.bombs.set(b.id, v);
      return v;
    }
    return undefined;
  }

  private syncPickups(world: WorldState, dt: number) {
    for (const v of this.pickups.values()) v.seen = false;
    for (const p of world.pickups.values()) {
      let v = this.pickups.get(p.id);
      if (!v) {
        v = new PickupView(this.a, this.tx, p);
        this.pickups.set(p.id, v);
        this.pickupLayer.addChild(v.root);
      }
      v.seen = true;
      v.update(p, dt);
      this.lastPickup.set(p.id, { x: p.x, y: p.y, type: p.type, t: this.time });
    }
    for (const [id, v] of this.pickups) if (!v.seen) { v.destroy(); this.pickups.delete(id); }
  }

  private syncFlames(world: WorldState, dt: number) {
    for (const v of this.flames.values()) v.seen = false;
    for (const f of world.flames.values()) {
      let v = this.flames.get(f.id);
      if (!v) {
        const c = this.flameCenters.get(f.y * 4096 + f.x);
        v = new FlameView(this.a, this.tx, f, c && this.time - c.t < 0.6 ? c : undefined);
        this.flames.set(f.id, v);
        this.flameLayer.addChild(v.sprite);
        this.flameGlow.addChild(v.glow);
      }
      v.seen = true;
      v.update(f, dt);
    }
    for (const [id, v] of this.flames) if (!v.seen) { v.destroy(); this.flames.delete(id); }
  }

  private gc() {
    const old = this.time - 3;
    for (const [k, v] of this.lastPickup) if (v.t < old) this.lastPickup.delete(k);
    for (const [k, v] of this.lastBomb) if (v.t < old) this.lastBomb.delete(k);
    for (const [k, v] of this.flameCenters) if (v.t < old) this.flameCenters.delete(k);
  }

  private updateOverlay(dt: number, world: WorldState | null) {
    // sudden death: red vignette breathing, with a strong pulse on the start event
    const sd = world?.phase === Phase.SuddenDeath;
    this.sdPulse = Math.max(0, this.sdPulse - dt * 1.2);
    const breathe = sd ? 0.22 + 0.14 * Math.sin(this.time * 3.2) : 0;
    const target = Math.min(1, breathe + this.sdPulse * 0.8);
    this.vignette.alpha += (target - this.vignette.alpha) * (1 - Math.exp(-dt * 8));
    this.vignette.visible = this.vignette.alpha > 0.01;
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.flashRect.alpha = this.flash * this.flash * 0.5;
    this.flashRect.tint = this.flashColor;
    this.flashRect.visible = this.flash > 0;
  }

  // ---------------------------------------------------------------- events
  private shakeAt(x: number, y: number, power: number) {
    this.camera.shakeAt(x, y, power);
  }

  private playerPos(id: string) {
    const p = this.world?.players.get(id);
    return p ? { x: p.x, y: p.y } : null;
  }

  handleEvents(events: GameEvent[], localId: string) {
    this.localId = localId;
    for (const e of events) {
      switch (e.type) {
        case 'explosion': {
          this.fx.explosion(e.x, e.y, e.cells, e.power);
          for (const c of e.cells) {
            const dist = Math.abs(c.x - e.x) + Math.abs(c.y - e.y);
            this.flameCenters.set(c.y * 4096 + c.x, { x: e.x, y: e.y, dist, t: this.time });
          }
          this.shakeAt(e.x, e.y, 0.6 + 0.1 * e.power);
          this.recentBooms.push({ x: e.x, y: e.y, t: this.time });
          if (this.recentBooms.length > 8) this.recentBooms.shift();
          break;
        }
        case 'bombFizzled': this.fx.fizzle(e.x, e.y); break;
        case 'bombKicked': {
          const b = this.lastBomb.get(e.bomb);
          const d = [[0, -1], [-1, 0], [1, 0], [0, 1]][e.dir];
          if (b) this.fx.whoosh(b.x, b.y, d[0], d[1]);
          break;
        }
        case 'bombPunched': {
          const b = this.lastBomb.get(e.bomb);
          if (b) this.fx.punch(b.x, b.y);
          break;
        }
        case 'bombThrown': {
          const p = this.playerPos(e.by);
          if (p) this.fx.dustRing(p.x * T, p.y * T + 8, 5, 40, 0xd8cdb8, 0.6);
          break;
        }
        case 'bombBounced': break; // the view squashes on each new hop
        case 'bombLanded': break;  // landing dust from the view's motion change
        case 'pickupCollected': {
          const k = this.lastPickup.get(e.pickup);
          const pos = k ?? this.playerPos(e.by);
          if (!pos) break;
          const kind = e.kind;
          const [text, color] = PICKUP_LABEL[kind] ?? ['', 0xffffff];
          const mine = e.by === localId;
          const icon = this.a.pickupIcon[(k?.type ?? kind) as PickupType];
          this.fx.collect(pos.x, pos.y, icon, mine ? text : '', color, kind !== PickupType.Skull);
          break;
        }
        case 'pickupBurned': {
          const k = this.lastPickup.get(e.pickup);
          this.fx.burn(e.x, e.y, this.a.pickupIcon[k?.type ?? PickupType.Random]);
          break;
        }
        case 'shieldBlocked': {
          const p = this.playerPos(e.player);
          if (p) this.fx.shieldBreak(p.x, p.y);
          break;
        }
        case 'playerStunned': {
          const p = this.playerPos(e.player);
          if (p) this.fx.stunHit(p.x, p.y);
          break;
        }
        case 'playerDied': this.shakeAt(e.x, e.y, 0.4); break;
        case 'curseApplied': {
          const p = this.playerPos(e.player);
          if (p) this.fx.curse(p.x, p.y);
          break;
        }
        case 'roundStart': this.flash = 1; this.flashColor = 0xffffff; break;
        case 'suddenDeath': this.sdPulse = 1; this.camera.shake(4); break;
        case 'roundOver': {
          const p = this.playerPos(e.winner);
          if (p) this.fx.confetti(p.x, p.y);
          break;
        }
        default: {
          // zone shrink events (being added to the contract): tolerate any field naming
          const z = e as unknown as { type: string; ring?: number; inset?: number };
          if (z.type === 'zoneWarning') this.arena.setZone(z.ring ?? z.inset ?? this.arena.nextRing());
          else if (z.type === 'zoneCancel') this.arena.setZone(-1);
          else if (z.type === 'zoneShrink') { this.arena.setZone(-1); this.camera.shake(3); }
          break;
        }
      }
    }
  }

  destroy() {
    this.ro.disconnect();
    for (const v of this.players.values()) v.destroy();
    this.app.destroy({ removeView: true }, { children: true });
  }
}

export type { CameraMode } from './camera';
/** GameRenderer plus the optional camera control used by the menu backdrop. */
export interface RendererExt extends GameRenderer {
  setCameraMode(mode: CameraMode): void;
}

export const createRenderer = async (opts: RendererOptions): Promise<RendererExt> => {
  const { parent, quality = 'high' } = opts;
  const app = new Application();
  const r = parent.getBoundingClientRect();
  await app.init({
    width: Math.max(1, r.width), height: Math.max(1, r.height),
    resolution: Math.min(MAX_DPR, window.devicePixelRatio || 1),
    autoDensity: true,
    antialias: false,
    roundPixels: true,
    background: 0x17121f,
    autoStart: false,
    sharedTicker: false,
    preference: 'webgl',
    powerPreference: 'high-performance',
  });
  app.ticker?.stop();
  const canvas = app.canvas;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.imageRendering = 'pixelated';
  canvas.style.touchAction = 'none';
  parent.appendChild(canvas);
  const assets = await loadAssets();
  installFonts();
  const tx = makeTextures();
  return new PixiRenderer(app, parent, assets, tx, quality);
};

export default createRenderer;
const _check: CreateRenderer = createRenderer;
void _check;
