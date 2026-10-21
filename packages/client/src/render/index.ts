// Pixi.js v8 renderer for WorldState. See contracts.ts (GameRenderer / CreateRenderer).
import { Application, Container, Rectangle, Sprite, Texture, TextureSource } from 'pixi.js';
import { ArenaShape, BombMotion, Theme, COUNTDOWN_TIME, DropKind, Phase, PickupType, TICK_RATE, type BombState, type GameEvent, type WorldState } from '@ob/game';

import type { CreateRenderer, GameRenderer, RendererOptions } from '../contracts';
import { Arena } from './arena';
import { loadAssets, type GameAssets } from './assets';
import { Camera, zoomPath, type CameraMode, type CameraView } from './camera';
import { Effects } from './fx';
import { Explosions } from './explosions';
import { Drops } from './drops';
import { Ground, shapeClearing, type Rect } from './ground';
import { BombView, PickupView } from './items';
import { PlayerView, type Frozen } from './players';
import { installFonts } from './text';
import { makeTextures, type ProcTextures } from './textures';
import { WeatherFx } from './weather';
import { Footprints } from './prints';
import { perfAdd, perfNow } from '../perf';

const T = 32;
const MAX_DPR = 2;
/** Camera trip between two maps (s); the round-start freeze (COUNTDOWN_TIME) is longer: heroes land before it ends. */
const TRAVEL = 1.2;
/** A trip covers at least this many screens (short side), however far the camera is zoomed out. */
const TRIP_SCREENS = 5;
/** The loader's countryside view drifts this way (world px/s); the first map lies further along it. */
const DRIFT = { x: 10, y: 4 };
/** preload() works in slices of this long (ms), so the loader keeps animating. */
const SLICE_MS = 8;
/** Heroes drop in no sooner than this long after the camera has arrived on the new map... */
const SPAWN_AFTER = 0.15;
/** ...and not before the countdown says «1» (this long before control starts), so it ticks evenly. */
const SPAWN_ON_ONE = 1;
/** The next trip's countryside is made ahead in frames that can spare this long (ms)... */
const AHEAD_MS = 2;
/** ...once the camera has been on the map this long (s), its own surroundings done first. */
const AHEAD_AFTER = 2;
/** A frame that has spent this long (ms) by the time the countryside is covered (a new map built,
 *  the old one frozen) makes no chunk that can wait. */
const HEAVY_MS = 6;

const PICKUP_LABEL: Record<PickupType, [string, number]> = {
  [PickupType.BombUp]: ['+1 BOMB', 0x8fe3ff], [PickupType.FireUp]: ['+1 FIRE', 0xffb35c],
  [PickupType.SpeedUp]: ['SPEED UP', 0x8dffb0], [PickupType.FullFire]: ['MAX FIRE!', 0xffd84a],
  [PickupType.Kick]: ['KICK', 0xffffff], [PickupType.Glove]: ['GLOVE', 0xffffff], [PickupType.Punch]: ['PUNCH', 0xffffff],
  [PickupType.Remote]: ['REMOTE', 0xffffff], [PickupType.Pierce]: ['PIERCE', 0xffb35c], [PickupType.LineBomb]: ['LINE BOMB', 0xffffff],
  [PickupType.BombPass]: ['BOMB PASS', 0xffffff], [PickupType.Shield]: ['SHIELD', 0x9fe6ff], [PickupType.Ghost]: ['GHOST', 0xd8e4ff],
  [PickupType.Crazy]: ['CRAZY BOMBS', 0xff7ad0], [PickupType.Fire]: ['ON FIRE!', 0xff8a4a], [PickupType.Heart]: ['+1 LIFE', 0xff7a8a],
  [PickupType.Skull]: ['CURSED!', 0xc58cff], [PickupType.Random]: ['???', 0xffffff], [PickupType.Teleport]: ['TELEPORT', 0xa8f0ff],
};

interface Known { x: number; y: number; t: number; }

class PixiRenderer implements GameRenderer {
  private view: CameraView = { cssW: 1, cssH: 1, res: 1 };
  private camera = new Camera();
  private worldRoot = new Container();
  /** Everything of the current map, placed at its world origin (the game's coordinates stay map-local). */
  private mapRoot = new Container();
  private arena: Arena;
  private ground: Ground;
  private fx: Effects;
  private drops: Drops;
  private weather: WeatherFx;
  private prints = new Footprints();
  /** Tiles where a sky drop just landed: the bomb / pickup appearing there gets a landing squash. */
  private landed = new Map<number, number>();
  private pickupLayer = new Container();
  private bombLayer = new Container({ sortableChildren: true });
  private airBombs = new Container({ sortableChildren: true });
  private explosions: Explosions;
  private entities = new Container({ sortableChildren: true });
  private tags = new Container();
  private overlay = new Container();
  private vignette: Sprite;
  private flashRect: Sprite;

  private players = new Map<string, PlayerView>();
  private bombs = new Map<number, BombView>();
  private pickups = new Map<number, PickupView>();
  /** Last known positions of entities that may already be gone when their event arrives. */
  private lastPickup = new Map<number, Known & { type: PickupType; }>();
  private lastBomb = new Map<number, Known>();

  private world: WorldState | null = null;
  private camMode: CameraMode = 'follow';
  private meAlive = false;
  private tightUntil = 0;
  private recentBooms: { x: number; y: number; t: number; }[] = [];
  private recentDeaths: { x: number; y: number; t: number; }[] = [];
  private localId = '';
  private time = 0;
  private flash = 0;
  private flashColor = 0xffffff;
  private sdPulse = 0;
  private ro: ResizeObserver;
  /** Map placement in the endless world: origin (tiles) and size of the current map. */
  private map = { ox: 0, oy: 0, w: 0, h: 0, shape: ArenaShape.Rect, theme: Theme.Meadow, shown: false, age: 0 };
  private ghost: { ox: number; oy: number; w: number; h: number; shape: ArenaShape; theme: Theme; t: number; fade?: number; } | null = null;
  private lastWorld: WorldState | null = null;
  private nextMap: 'travel' | 'snap' | null = null;
  private spawnDelay = -1;
  /** Frozen heroes of the old arena that keep running the way they went until it dissolves. */
  private runners: Frozen[] = [];
  /** Optional hook: a camera travel to a new map starts (not on the first map's snap). */
  onTravel?: (durationMs: number, dx: number, dy: number) => void;
  /** Optional hook: teleport moments (frozen hero beams out / hero drops in on a new map). */
  set onTeleport(f: ((kind: 'beamOut' | 'dropIn', x: number, y: number, who: string, crowd?: number) => void) | undefined) { this.fx.sound = f; }
  /** Optional hook: a storm's lightning; the thunder should follow after `delaySec`. */
  set onThunder(f: ((delaySec: number, power: number) => void) | undefined) { this.weather.onThunder = f; }
  /** preload(): where the first map after the loader goes (its countryside is drawn already). */
  private planned: { ox: number; oy: number; w: number; h: number; } | null = null;
  /** The countryside preload() drew stays cached until the camera has arrived. */
  private releaseAfterTrip = false;
  /** depart(): the map on show was left before the next world came; it lands where the trip ends. */
  private departed = false;
  /** Where the trip away from the map on show will head (drawn ahead, see planAhead()). */
  private ahead: { key: string; dir: TripDir; planned: boolean } | null = null;
  /** Seconds since the camera arrived on the map on show. */
  private settled = 0;
  /** prime(): the next new map is already running (no spawn wave); scorch these cells into it. */
  private primed: { x: number; y: number; }[][] | null = null;

  constructor(private app: Application, private parent: HTMLElement, private a: GameAssets, private tx: ProcTextures, quality: 'low' | 'high') {
    this.fx = new Effects(a, tx);
    this.ground = new Ground(a);
    // chunks made ahead go onto the GPU right away, not in the frame that first shows them
    const gl = (app.renderer as unknown as { texture: { initSource(s: TextureSource): void; }; }).texture;
    this.ground.onPrepared = (tex) => { try { gl.initSource(tex.source); } catch (e) { console.warn('[render] upload', e); } };
    this.arena = new Arena(a, tx, this.fx);
    this.arena.onImpact = (x, y) => this.shakeAt(x, y, 0.8);
    this.explosions = new Explosions(a, tx);
    this.drops = new Drops(a);
    this.weather = new WeatherFx(tx);
    // grounded bombs and pickups always sit under the characters (no y-sorting with players);
    // carried and flying bombs go above them
    this.mapRoot.addChild(
      this.arena.root, this.prints.root, this.arena.zoneLayer, this.fx.under, this.arena.fallingShadows, this.drops.shadows, this.pickupLayer, this.bombLayer,
      this.explosions.root, this.explosions.glow, this.entities, this.airBombs, this.fx.particles.normal, this.arena.fallingRoot, this.drops.air,
      // the night darkens everything above, its lights and the additive glows shine through
      this.weather.dark, this.fx.over, this.fx.particles.additive, this.fx.light, this.weather.lights, this.tags, this.fx.labels,
    );
    this.worldRoot.addChild(this.ground.root, this.arena.ghostRoot, this.mapRoot);
    this.arena.fallingRoot.sortableChildren = true;
    this.vignette = new Sprite({ texture: tx.vignette, tint: 0xff1a2a, alpha: 0 });
    this.flashRect = new Sprite({ texture: Texture.WHITE, alpha: 0 });
    this.overlay.addChild(this.vignette, this.flashRect);
    app.stage.addChild(this.worldRoot, this.weather.screen, this.overlay);
    this.setQuality(quality);

    // ResizeObserver runs after this frame was drawn, and resizing the canvas wipes its buffer:
    // redraw right away, otherwise the screen stays black until the next frame (every frame
    // while a window edge is being dragged).
    this.ro = new ResizeObserver(() => { if (this.resize()) this.redraw(); });
    this.ro.observe(parent);
    this.resize();
  }

  /** Returns true when the canvas size actually changed. */
  private resize(): boolean {
    const r = this.parent.getBoundingClientRect();
    const res = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === this.view.cssW && h === this.view.cssH && res === this.view.res) return false;
    this.view = { cssW: w, cssH: h, res };
    this.app.renderer.resize(w, h, res);
    this.vignette.width = w; this.vignette.height = h;
    this.flashRect.width = w; this.flashRect.height = h;
    return true;
  }

  /** Re-present the last frame for the current canvas size (no simulation / animation step). */
  private redraw() {
    if (this.world) this.present();
    this.app.render();
  }

  /** Camera → containers; cover the visible world rect with ground chunks and cull the arena. */
  private present() {
    this.camera.apply(this.worldRoot, this.view);
    const sc = this.worldRoot.scale.x, ox = this.worldRoot.x, oy = this.worldRoot.y;
    const x0 = -ox / sc, y0 = -oy / sc, x1 = (this.view.cssW - ox) / sc, y1 = (this.view.cssH - oy) / sc;
    // a shaped arena doesn't hide the whole of its box: only a rectangle covers the ground
    const covers: Rect[] = [];
    if (this.map.shape === ArenaShape.Rect) covers.push(this.floorRect(this.map));
    if (this.ghost?.shape === ArenaShape.Rect) covers.push(this.floorRect(this.ghost));
    this.ground.setCovers(covers);
    const g0 = perfNow(), made = this.ground.generated;
    const heavy = performance.now() - this.frameStart > HEAVY_MS;
    this.ground.cover(x0, y0, x1, y1, this.camera.zoom, heavy ? 0 : this.camera.travelling ? 4 : 2);
    perfAdd('gnd', perfNow() - g0, this.ground.generated - made);
    const mx = this.map.ox * T, my = this.map.oy * T;
    this.arena.cull(x0 - mx - T, y0 - my - T, x1 - mx + T, y1 - my + T, this.camera.zoom);
    return { x0, y0, x1, y1 };
  }

  /** Arena floor (opaque, hides the ground), world px. */
  private floorRect(m: { ox: number; oy: number; w: number; h: number; }): Rect {
    return { x0: (m.ox - 0.5) * T, y0: (m.oy - 0.5) * T, x1: (m.ox + m.w - 0.5) * T, y1: (m.oy + m.h - 0.5) * T };
  }

  /** Outer edge of the border wall ring, world px. */
  private wallRect(m: { ox: number; oy: number; w: number; h: number; shape?: ArenaShape; theme?: Theme }): Rect {
    let r: Rect = { x0: (m.ox - 1.5) * T, y0: (m.oy - 1.5) * T, x1: (m.ox + m.w + 0.5) * T, y1: (m.oy + m.h + 0.5) * T };
    if (m.shape) r = shapeClearing(r, m.shape, m.ox, m.oy, m.w, m.h);
    return { ...r, theme: m.theme, key: `${m.shape ?? 0}:${m.theme ?? 0}:${m.ox},${m.oy}` };
  }

  /**
   * Optional extra: how the next new map is shown. 'travel' (default once a map was shown): the
   * camera glides over the world from the old arena to the new one; 'snap': it simply appears.
   * Also marks the next world as a new map even when its size and round match the old one.
   */
  transition(kind: 'travel' | 'snap' = 'travel') { this.nextMap = kind; }

  /**
   * Optional extra: the next world handed to render() has been running for a while (e.g. a
   * fast-forwarded menu match). Call it right after switching to that source, before its first
   * render(). Only the lasting marks of `events` are applied (scorch trails of the current round's
   * explosions), with no particles, shake, flashes or sounds, and that map gets no spawn wave: its
   * heroes are simply there. The camera still travels to it from a previous map.
   */
  prime(events: GameEvent[]) {
    // only this round's explosions (a round opens with its 'countdown' events)
    let from = 0;
    events.forEach((e, i) => { if (e.type === 'countdown') from = i + 1; });
    this.primed = [];
    for (let i = from; i < events.length; i++) {
      const e = events[i];
      if (e.type === 'explosion') this.primed.push(e.cells);
    }
  }

  setQuality(q: 'low' | 'high') {
    this.fx.lowQuality = q === 'low';
    this.fx.particles.max = q === 'low' ? 350 : 1400;
    this.weather.lowQuality = q === 'low';
    this.explosions.glow.visible = q === 'high';
  }

  // ---------------------------------------------------------------- frame
  render(world: WorldState | null, localId: string, dtMs: number) {
    this.frameStart = performance.now();
    const dt = Math.min(0.1, Math.max(0, dtMs / 1000));
    this.time += dt;
    this.world = world;
    this.localId = localId;
    if (!world) {
      if (this.departed) this.flyOn(dt); else this.landscape(dt);
      this.updateOverlay(dt, null);
      this.app.render();
      return;
    }
    this.worldRoot.visible = true;
    // the first map after the loader's countryside: the camera flies over to it
    const flyIn = !this.map.shown && this.landscapeShown;

    // a new GameSource brings its own world object: always a new map
    const swapped = world !== this.lastWorld && this.lastWorld !== null;
    this.lastWorld = world;
    // travel only from a map that was actually on screen for a moment; a map replaced right away
    // (a new source's waiting map → round 1) just becomes the new destination of the trip
    this.map.age += dt;
    const young = this.map.age < 0.75;
    const travel = this.map.shown && this.nextMap !== 'snap' && (!young || this.camera.travelling);
    // (after depart(): the old map is frozen already, the new one lands where the trip goes)
    const force = swapped || this.nextMap !== null || this.departed;
    // leaving a map for good: freeze it as it looks now (tiles, scorch, graves, pickups, bombs, heroes)
    const frozen = travel && !young && !this.departed && this.arena.willRebuild(world, force) ? this.freezeMap() : null;
    const fresh = this.arena.sync(world, dt, force);
    if (fresh) this.onNewMap(world, travel, this.departed || (travel && young), flyIn);
    if (fresh && frozen) this.placeFrozen(frozen);
    if (fresh && this.primed) {
      for (const cells of this.primed) this.arena.scorch(cells);
      this.primed = null;
      this.spawnDelay = -1;
    }

    this.syncPlayers(world, dt, fresh);
    this.prints.update(world, dt);
    this.syncBombs(world, dt);
    this.syncPickups(world, dt);
    this.drops.sync(world.drops ?? [], dt);
    this.explosions.update(dt);
    this.fx.update(dt);
    this.gc();
    if (this.releaseAfterTrip && !this.camera.travelling) { this.releaseAfterTrip = false; this.ground.release(); }
    this.settled = this.camera.travelling ? 0 : this.settled + dt;
    this.planAhead(world);

    this.updateCamera(world, localId, dt);
    const view = this.present();
    this.updateGhost(dt, view);
    const mx = this.map.ox * T, my = this.map.oy * T;
    this.weather.update(dt, this.view.cssW, this.view.cssH, this.worldRoot.x, this.worldRoot.y, this.worldRoot.scale.x, world,
      { x0: view.x0 - mx, y0: view.y0 - my, x1: view.x1 - mx, y1: view.y1 - my });
    this.updateOverlay(dt, world);
    const p0 = perfNow();
    this.app.render();
    perfAdd('pixi', perfNow() - p0);
  }

  /** Optional extra beyond GameRenderer: 'follow' (default), 'overview' or 'attract' (menu backdrop). */
  /** Optional extra: css px covered by UI on the left (main menu panel), framing uses the rest. */
  setViewInset(left: number) { this.camera.insetLeft = Math.max(0, left); }

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
    let interest: { x: number; y: number; }[] = [];
    if (mode === 'attract') {
      for (const p of world.players.values()) if (p.alive && p.inRound) interest.push(p);
      const recent = this.recentBooms.filter(b => this.time - b.t < 3);
      if (recent.length) interest = interest.concat(recent, recent); // explosions weigh double
    }
    let action: { x0: number; y0: number; x1: number; y1: number; } | null = null;
    if (mode === 'overview' && world.phase !== Phase.RoundOver) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const add = (x: number, y: number) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
      for (const p of world.players.values()) if (p.alive && p.inRound) add(p.x, p.y);
      for (const d of this.recentDeaths) if (this.time - d.t < 3) add(d.x, d.y);
      // a shaped arena: heroes on two of its tips would frame the empty countryside between them,
      // so its middle is always in the shot
      if (x0 <= x1 && world.shape !== ArenaShape.Rect) add((world.width - 1) / 2, (world.height - 1) / 2);
      if (x0 <= x1) action = { x0, y0, x1, y1 };
    }
    this.camera.update(dt, this.view, {
      aw: world.width, ah: world.height,
      focus: playing ? { x: me!.x, y: me!.y } : null,
      tight: world.phase === Phase.Countdown || this.time < this.tightUntil,
      interest,
      action,
    });
  }

  /** No game yet (the loader) or between sources: the endless countryside, the camera drifting slowly over it. */
  private landscape(dt: number) {
    const c = this.camera;
    this.worldRoot.visible = true;
    if (!this.landscapeShown && !this.map.shown) {
      const short = Math.min(this.view.cssW, this.view.cssH) * this.view.res;
      c.zoom = Math.max(1, Math.round((short / (14 * T)) * 2) / 2);
      c.x = 0; c.y = 0;
    }
    this.landscapeShown = true;
    c.x += DRIFT.x * dt; c.y += DRIFT.y * dt;
    this.present();
  }
  private landscapeShown = false;
  /** When the current render() began (performance.now()). */
  private frameStart = 0;

  private onNewMap(world: WorldState, travel: boolean, retarget: boolean, flyIn = false) {
    for (const v of this.bombs.values()) v.destroy();
    for (const v of this.pickups.values()) v.destroy();
    this.explosions.clear();
    this.bombs.clear(); this.pickups.clear();
    this.fx.clear();
    this.drops.clear();
    this.weather.set(world);
    this.prints.clear();
    this.fx.weather = this.weather.smoke();
    this.landed.clear();
    this.nextMap = null;
    this.recentBooms.length = 0; this.recentDeaths.length = 0;
    const m = this.map;
    this.departed = false;
    this.mapRoot.visible = true;
    if (retarget) {
      // same spot (centred), the trip keeps going
      m.ox = Math.round(m.ox + (m.w - world.width) / 2); m.oy = Math.round(m.oy + (m.h - world.height) / 2);
      this.camera.ox = m.ox * T; this.camera.oy = m.oy * T;
      this.spawnDelay = Math.max(this.camera.travelLeft + SPAWN_AFTER, this.untilOne(world));
    } else if (travel || flyIn) {
      // a trip to the new map: from the old arena, which stays where it was, or (the first map,
      // after the loader) from the spot of countryside the view drifted to
      if (travel) {
        this.ghost = { ox: m.ox, oy: m.oy, w: m.w, h: m.h, shape: m.shape, theme: m.theme, t: 0 };
        this.arena.ghostRoot.position.set(m.ox * T, m.oy * T);
      }
      const from = travel ? m : { ox: Math.round(this.camera.x / T), oy: Math.round(this.camera.y / T), w: 1, h: 1 };
      // (from the countryside: straight on, the way the view was already drifting; preload() may
      // have placed it already)
      const p = this.planned;
      // (between maps: the way drawn ahead, whose countryside may be made already)
      const ahead = travel && this.ahead?.key === mapKey(m) ? this.ahead : null;
      const dir = ahead?.dir ?? (travel ? tripDir(m) : { ang: Math.atan2(DRIFT.y, DRIFT.x), gap: 28 + Math.random() * 14 });
      const [nx, ny] = !travel && p && p.w === world.width && p.h === world.height
        ? [p.ox, p.oy] : this.tripTo(from, world.width, world.height, dir);
      if (!travel && p) { this.planned = null; this.releaseAfterTrip = true; }
      if (ahead?.planned) this.releaseAfterTrip = true;
      this.ahead = null;
      const ddx = nx + world.width / 2 - (from.ox + from.w / 2), ddy = ny + world.height / 2 - (from.oy + from.h / 2), dl = Math.hypot(ddx, ddy) || 1;
      try { this.onTravel?.(TRAVEL * 1000, ddx / dl, ddy / dl); } catch (e) { console.warn('[render] onTravel', e); }
      m.ox = nx; m.oy = ny;
      this.camera.ox = m.ox * T; this.camera.oy = m.oy * T;
      this.camera.travel(TRAVEL);
      // get the countryside around the destination ready while the camera is on its way
      const pad = 14 * T;
      this.ground.want((m.ox - 1.5) * T - pad, (m.oy - 1.5) * T - pad, (m.ox + world.width + 0.5) * T + pad, (m.oy + world.height + 0.5) * T + pad);
      this.spawnDelay = Math.max(TRAVEL + SPAWN_AFTER, this.untilOne(world));
    } else {
      if (this.ahead?.planned) this.ground.release();
      this.ahead = null;
      this.arena.clearGhost();
      this.ghost = null;
      this.camera.ox = m.ox * T; this.camera.oy = m.oy * T;
      this.camera.reset();
      this.spawnDelay = m.shown ? 0.1 : -1; // the very first map simply appears
    }
    m.w = world.width; m.h = world.height; m.shape = world.shape ?? ArenaShape.Rect; m.theme = world.theme ?? Theme.Meadow; m.shown = true; m.age = 0;
    this.mapRoot.position.set(m.ox * T, m.oy * T);
    this.syncClearings();
  }

  /** Where a new map goes when the camera travels to it from `from`. The stretch of countryside is as
   *  long on screen from the zoomed-out menu view as from a close follow: it scales with the tiles
   *  the screen shows now and once framed on the new arena. */
  /**
   * Optional extra: leave the map on show right away (connecting to a game): it freezes where it
   * is, like at the end of a round, and the camera sets off along the trip drawn ahead into the
   * countryside. The next world, whenever it comes (the server may take a moment), lands at the
   * far end of that trip and the flight just goes on there; until then render(null) flies on.
   */
  depart() {
    const m = this.map;
    if (!m.shown || this.departed) return;
    const frozen = this.freezeMap();
    this.ghost = { ox: m.ox, oy: m.oy, w: m.w, h: m.h, shape: m.shape, theme: m.theme, t: 0 };
    this.arena.ghostRoot.position.set(m.ox * T, m.oy * T);
    this.placeFrozen(frozen);
    // the next map's size isn't known yet: it's placed as if it were this one's
    const ahead = this.ahead?.key === mapKey(m) ? this.ahead : null;
    const [nx, ny] = this.tripTo(m, m.w, m.h, ahead?.dir ?? tripDir(m));
    if (ahead?.planned) this.releaseAfterTrip = true;
    this.ahead = null;
    const ddx = nx - m.ox, ddy = ny - m.oy, dl = Math.hypot(ddx, ddy) || 1;
    try { this.onTravel?.(TRAVEL * 1000, ddx / dl, ddy / dl); } catch (e) { console.warn('[render] onTravel', e); }
    m.ox = nx; m.oy = ny; m.age = 0;
    this.camera.ox = m.ox * T; this.camera.oy = m.oy * T;
    this.camera.mode = 'overview';
    this.camera.travel(TRAVEL);
    const pad = 14 * T;
    this.ground.want((m.ox - 1.5) * T - pad, (m.oy - 1.5) * T - pad, (m.ox + m.w + 0.5) * T + pad, (m.oy + m.h + 0.5) * T + pad);
    // the live arena, its heroes and effects are the old world's: hidden until the next one
    this.mapRoot.visible = false;
    this.departed = true;
  }

  /** Between depart() and the next world: the camera goes on to the spot the next map lands on. */
  private flyOn(dt: number) {
    const m = this.map;
    this.worldRoot.visible = true;
    this.camera.update(dt, this.view, { aw: m.w, ah: m.h, focus: null, tight: false, interest: [], action: null });
    const view = this.present();
    this.updateGhost(dt, view);
  }

  /**
   * Where the sound is heard from: the camera's centre in the current map's tiles, and how much
   * the camera is at that map (1 framing it .. 0 a screen and more away, e.g. mid-trip).
   */
  listener(): { x: number; y: number; presence: number; } | null {
    const m = this.map;
    if (!m.shown || this.departed) return null;
    const c = this.camera, x = (c.x - m.ox * T) / T, y = (c.y - m.oy * T) / T;
    const outX = Math.max(0, -1 - x, x - m.w), outY = Math.max(0, -1 - y, y - m.h);
    const half = Math.min(this.view.cssW, this.view.cssH) * this.view.res / c.zoom / T / 2;
    return { x, y, presence: Math.max(0, Math.min(1, 1 - Math.hypot(outX, outY) / Math.max(4, half * 2))) };
  }

  private tripTo(from: { ox: number; oy: number; w: number; h: number; }, w: number, h: number, dir: TripDir, zoom = this.camera.zoom) {
    const W = this.view.cssW * this.view.res, H = this.view.cssH * this.view.res, short = Math.min(W, H);
    const fit = Math.min(W / (w + 2.6), H / (h + 2.6));
    const shown = Math.max(short / (zoom * T), short / fit);
    return nextOrigin(from, w, h, shown * TRIP_SCREENS, dir);
  }

  /**
   * While a map is on show: draw where the trip away from it will head, and make the countryside
   * the camera will fly over (the zoomed-out views of the way) in frames that can spare the time:
   * while the round is decided, or our hero isn't playing (menu, spectating). The next map's size
   * isn't known yet, so it's placed as if it were this one's; its surroundings are left for the
   * trip itself (they depend on the arena's clearing and theme).
   */
  private planAhead(world: WorldState) {
    const m = this.map;
    if (!m.shown || this.camera.travelling || this.ghost || this.planned || this.releaseAfterTrip || this.settled < AHEAD_AFTER) return;
    const key = mapKey(m);
    if (this.ahead?.key !== key) this.ahead = { key, dir: tripDir(m), planned: false };
    if (!this.ahead.planned) {
      this.ahead.planned = true;
      const W = this.view.cssW * this.view.res, H = this.view.cssH * this.view.res, S = Math.min(W, H);
      const fit = Math.min(W / ((m.w + 2.6) * T), H / ((m.h + 2.6) * T));
      // (the camera leaves from the arena overview, as when a round is over)
      const [ox, oy] = this.tripTo(m, m.w, m.h, this.ahead.dir, fit);
      const x0 = (m.ox + (m.w - 1) / 2) * T, y0 = (m.oy + (m.h - 1) / 2) * T;
      const x1 = (ox + (m.w - 1) / 2) * T, y1 = (oy + (m.h - 1) / 2) * T;
      // the destination's surroundings are redrawn once its clearing is known: not those
      const slack = 4 * T, dest = this.wallRect({ ox, oy, w: m.w, h: m.h });
      const avoid: Rect = { x0: dest.x0 - slack, y0: dest.y0 - slack, x1: dest.x1 + slack, y1: dest.y1 + slack };
      // (half a chunk of margin: the views between the samples; the zoom changes fastest near the
      // ends, where the samples are denser)
      const mg = 8 * T, N = 96;
      for (let i = 0; i <= N; i++) {
        const e = (1 - Math.cos((i / N) * Math.PI)) / 2;
        const [x, y, vw] = zoomPath(x0, y0, S / fit, x1, y1, S / fit, e), z = S / vw;
        this.ground.plan(x - W / z / 2 - mg, y - H / z / 2 - mg, x + W / z / 2 + mg, y + H / z / 2 + mg, z, avoid);
      }
    }
    const idle = world.phase === Phase.RoundOver || !this.meAlive;
    if (idle && this.ground.pending) this.ground.prepare(AHEAD_MS);
  }

  /**
   * While the loader still runs: put every texture on the GPU and, for the world the loader opens
   * on, place its map now and draw the countryside the camera flies over on the way there (kept
   * cached until it has arrived), so pressing «Играть» has none of it left to do. The work goes in
   * slices, the loader keeps animating; `onProgress` gets the share done (0..1).
   */
  async preload(world: WorldState | null, onProgress?: (done: number) => void) {
    const gl = (this.app.renderer as unknown as { texture: { initSource(s: TextureSource): void; }; }).texture;
    const upload = (s: TextureSource) => { try { gl.initSource(s); } catch (e) { console.warn('[render] upload', e); } };
    const slice = () => new Promise<void>((r) => { requestAnimationFrame(() => r()); setTimeout(r, 50); });
    const sources = [...textureSources([this.a, this.tx, this.arena.prewarm()])];
    const texShare = world ? 0.2 : 1;
    let t0 = performance.now();
    for (let i = 0; i < sources.length; i++) {
      upload(sources[i]);
      if (performance.now() - t0 > SLICE_MS) { onProgress?.((texShare * i) / sources.length); await slice(); t0 = performance.now(); }
    }
    await slice(); // the countryside view has been framed (camera zoom) by now
    this.ground.warmUp();
    await slice();
    if (!world || this.map.shown) return;
    this.planFirstMap(world);
    const total = this.ground.pending || 1;
    while (!this.ground.prepare(SLICE_MS)) {
      onProgress?.(texShare + (1 - texShare) * (1 - this.ground.pending / total));
      await slice();
    }
  }

  /** The first map after the loader: placed straight on along the drift, its clearing set (so the
   *  chunks made now aren't redrawn when it appears), the trip's chunks queued back to front. */
  private planFirstMap(world: WorldState) {
    const c = this.camera, w = world.width, h = world.height;
    const [ox, oy] = this.tripTo({ ox: Math.round(c.x / T), oy: Math.round(c.y / T), w: 1, h: 1 }, w, h, { ang: Math.atan2(DRIFT.y, DRIFT.x), gap: 28 + Math.random() * 14 });
    this.planned = { ox, oy, w, h };
    this.ground.setClearings([this.wallRect({ ox, oy, w, h, shape: world.shape ?? ArenaShape.Rect, theme: world.theme ?? Theme.Meadow })]);
    const W = this.view.cssW * this.view.res, H = this.view.cssH * this.view.res, S = Math.min(W, H);
    const fit = Math.min(W / ((w + 2.6) * T), H / ((h + 2.6) * T));
    // (half a chunk of margin: the views between the samples, and a camera that drifted on meanwhile)
    const m = 8 * T;
    const view = (x: number, y: number, z: number) => this.ground.plan(x - W / z / 2 - m, y - H / z / 2 - m, x + W / z / 2 + m, y + H / z / 2 + m, z);
    // the arena's surroundings first (the camera stays there), as onNewMap() queues them
    const pad = 14 * T, x1 = (ox + (w - 1) / 2) * T, y1 = (oy + (h - 1) / 2) * T;
    view(x1, y1, fit);
    this.ground.plan((ox - 1.5) * T - pad, (oy - 1.5) * T - pad, (ox + w + 0.5) * T + pad, (oy + h + 0.5) * T + pad, 1);
    for (let i = 96; i >= 0; i--) {
      const [x, y, vw] = zoomPath(c.x, c.y, S / c.zoom, x1, y1, S / fit, (1 - Math.cos((i / 96) * Math.PI)) / 2);
      view(x, y, S / vw);
    }
  }

  /** Seconds until the round's countdown reaches «1» (0 when it isn't counting down). */
  private untilOne(world: WorldState) {
    return world.phase === Phase.Countdown ? Math.max(0, world.phaseTicks / TICK_RATE - SPAWN_ON_ONE) : 0;
  }

  /** Snapshot of the current map (still at its origin) and still copies of its heroes. */
  private freezeMap() {
    const m = this.map;
    // (the night stays out of it: it covers the whole screen and fades with the weather, not the map)
    const hide = [this.fx.over, this.fx.light, this.fx.particles.normal, this.fx.particles.additive, this.tags, this.entities,
    this.arena.zoneLayer, this.drops.air, this.arena.fallingRoot, this.weather.dark, this.weather.lights, this.fx.labels];
    const was = hide.map(c => c.visible);
    hide.forEach(c => { c.visible = false; });
    this.arena.showAll(this.camera.zoom);
    const x0 = -1.5 * T, y0 = -1.5 * T, w = (m.w + 2) * T, h = (m.h + 2) * T;
    const res = Math.min(1, 2048 / Math.max(w, h));
    let tex: Texture | null = null;
    try {
      tex = this.app.renderer.generateTexture({ target: this.mapRoot, frame: new Rectangle(x0, y0, w, h), resolution: res, antialias: false });
      tex.source.scaleMode = 'nearest';
    } catch (e) { console.warn('[render] snapshot failed', e); }
    hide.forEach((c, i) => { c.visible = was[i]; });
    const heroes: (Frozen & { local: boolean; })[] = [];
    for (const [id, v] of this.players) { const f = v.freeze(); if (f) heroes.push({ ...f, local: id === this.localId }); }
    return { tex, x0, y0, w, h, heroes };
  }

  private placeFrozen(f: ReturnType<PixiRenderer['freezeMap']>) {
    const root = this.arena.ghostRoot;
    this.arena.clearGhost();
    root.alpha = 1;
    if (f.tex) {
      const s = new Sprite({ texture: f.tex, x: f.x0, y: f.y0 });
      s.width = f.w; s.height = f.h;
      s.label = 'snapshot';
      root.addChild(s);
    }
    // the others keep running the way they went; only our own hero beams over to the new map
    this.runners = [];
    for (const h of f.heroes.sort((a, b) => a.c.y - b.c.y)) {
      root.addChild(h.c);
      if (h.local) this.fx.teleportOut(root, h.c, 0.18);
      else this.runners.push(h);
    }
  }

  /** Drop the previous arena once the camera has left it behind (or after a while). */
  private updateGhost(dt: number, v: Rect) {
    for (const r of this.runners) {
      if (r.c.destroyed) continue;
      r.t += dt;
      r.c.x += r.vx * dt; r.c.y += r.vy * dt;
      r.c.zIndex = r.c.y;
      const n = r.frames.length;
      if (n) r.body.texture = r.frames[Math.floor(r.t * r.fps) % n];
    }
    const g = this.ghost;
    if (!g || this.camera.travelling) return;
    g.t += dt;
    const r = this.wallRect(g);
    const seen = r.x1 > v.x0 && r.x0 < v.x1 && r.y1 > v.y0 && r.y0 < v.y1;
    const root = this.arena.ghostRoot;
    if (seen && g.t < 4) return;
    // dissolve in hard steps (no smooth fade over pixel art)
    g.fade = seen ? Math.max(0, (g.fade ?? 1) - dt * 2) : 0;
    root.alpha = Math.ceil(g.fade * 3) / 3;
    if (root.alpha > 0) return;
    this.arena.clearGhost();
    this.runners = [];
    root.alpha = 1;
    this.ghost = null;
    this.syncClearings();
  }

  /** Trampled aprons around the arenas on show (current + the one being left). */
  private syncClearings() {
    const list = [this.wallRect(this.map)];
    if (this.ghost) list.push(this.wallRect(this.ghost));
    this.ground.setClearings(list);
  }

  /** A hero leaving the arena: the pixel teleport-out (and its sound) at their last spot and pose. */
  private beamAway(hero: Frozen) {
    const box = new Container();
    this.fx.hold(box, this.fx.over, 0.5);
    box.addChild(hero.c);
    this.fx.teleportOut(box, hero.c, 0);
  }

  private syncPlayers(world: WorldState, dt: number, fresh: boolean) {
    for (const v of this.players.values()) v.seen = false;
    // round start: heroes drop in one by one at random moments (our own early), everyone landed
    // before the countdown ends
    const delay = fresh ? this.spawnDelay : -1;
    const win = Math.max(0, Math.min(0.9, COUNTDOWN_TIME / TICK_RATE - 0.55 - Math.max(0, delay)));
    const carried = new Set<number>();
    for (const b of world.bombs.values()) if (b.motion === 3) carried.add(b.id);
    for (const p of world.players.values()) {
      let v = this.players.get(p.id);
      if (!v) {
        v = new PlayerView(this.a, this.tx, this.fx);
        this.players.set(p.id, v);
        this.entities.addChild(v.root);
        this.tags.addChild(v.tag);
        if (!fresh) v.update(p, 0, p.id === this.localId, true, false);
      }
      v.seen = true;
      // left the round alive (stopped playing): beam out from the last pose
      const leaving = !fresh && !p.inRound && v.shown ? v.freeze() : null;
      const stagger = delay < 0 ? -1 : delay + Math.random() * (p.id === this.localId ? Math.min(0.15, win * 0.3) : win);
      v.update(p, dt, p.id === this.localId, fresh, p.carrying >= 0 && carried.has(p.carrying), stagger);
      v.dimTag(this.fx.labelNear(v.tag.x, v.tag.y), dt);
      if (leaving) this.beamAway(leaving);
    }
    for (const [id, v] of this.players) if (!v.seen) {
      // gone from the world alive (left the arena, bot removed) — not a death, not a map switch
      if (!fresh && v.shown) { const f = v.freeze(); if (f) this.beamAway(f); }
      v.destroy(); this.players.delete(id);
    }
    // local tag on top of the others
    const me = this.players.get(this.localId);
    if (me && me.tag.parent === this.tags && this.tags.children[this.tags.children.length - 1] !== me.tag) this.tags.addChild(me.tag);
  }

  private syncBombs(world: WorldState, dt: number) {
    for (const v of this.bombs.values()) v.seen = false;
    let holders: Map<number, { x: number; y: number; }> | null = null;
    for (const b of world.bombs.values()) {
      let v = this.bombs.get(b.id);
      if (!v && b.id >= 0) v = this.adoptPredicted(b);
      if (!v) {
        v = new BombView(this.a, this.tx, this.fx, b);
        this.bombs.set(b.id, v);
        if (this.takeLanded(b.x, b.y)) v.land();
      }
      v.seen = true;
      let holder: { x: number; y: number; } | null = null;
      if (b.motion === 3) {
        if (!holders) {
          holders = new Map();
          for (const p of world.players.values()) if (p.carrying >= 0) holders.set(p.carrying, p);
        }
        holder = holders.get(b.id) ?? null;
      }
      v.update(b, dt, holder);
      const layer = b.motion === BombMotion.Carried || b.motion === BombMotion.Flying ? this.airBombs : this.bombLayer;
      if (v.root.parent !== layer) layer.addChild(v.root);
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
        if (this.takeLanded(p.x, p.y)) v.land();
        this.pickupLayer.addChild(v.root);
      }
      v.seen = true;
      v.update(p, dt);
      this.lastPickup.set(p.id, { x: p.x, y: p.y, type: p.type, t: this.time });
    }
    for (const [id, v] of this.pickups) if (!v.seen) { v.destroy(); this.pickups.delete(id); }
  }

  private takeLanded(x: number, y: number) {
    const k = Math.round(y) * 4096 + Math.round(x);
    const t = this.landed.get(k);
    if (t === undefined) return false;
    this.landed.delete(k);
    return this.time - t < 0.6;
  }

  private gc() {
    const old = this.time - 3;
    for (const [k, v] of this.lastPickup) if (v.t < old) this.lastPickup.delete(k);
    for (const [k, v] of this.lastBomb) if (v.t < old) this.lastBomb.delete(k);
    for (const [k, t] of this.landed) if (this.time - t > 1) this.landed.delete(k);
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
          this.explosions.add(e);
          this.arena.scorch(e.cells);
          this.fx.explosion(e.x, e.y, e.cells, e.power);
          this.shakeAt(e.x, e.y, 0.6 + 0.1 * e.power);
          this.recentBooms.push({ x: e.x, y: e.y, t: this.time });
          if (this.recentBooms.length > 8) this.recentBooms.shift();
          break;
        }
        case 'bombFizzled': this.fx.fizzle(e.x, e.y); break;
        case 'playerTeleported': {
          // our teleport: beam out from the old spot (a frozen copy), drop in at the new one
          const v = this.players.get(e.player);
          if (!v) break;
          const f = v.freeze();
          if (f) this.beamAway(f);
          v.teleportIn(e.x, e.y);
          if (e.player === localId) this.camera.travel(0.35, true); // a quick eased pan, not a long trip
          break;
        }
        case 'dropLanded': {
          const bomb = e.kind === DropKind.Bomb;
          this.fx.dropLand(e.x, e.y, bomb);
          this.landed.set(e.y * 4096 + e.x, this.time);
          if (bomb) this.shakeAt(e.x, e.y, 0.5);
          break;
        }
        case 'bombVanished': this.fx.vanish(e.x, e.y); break;
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
          const icon = this.a.pickupIcon[(k?.type ?? kind) as PickupType] ?? Texture.EMPTY;
          const follow = () => { const h = this.playerPos(e.by); return h ? { x: h.x * T, y: h.y * T } : null; };
          this.fx.collect(pos.x, pos.y, icon, mine ? text : '', color, kind !== PickupType.Skull, follow);
          break;
        }
        case 'pickupBurned': {
          const k = this.lastPickup.get(e.pickup);
          this.fx.burn(e.x, e.y, this.a.pickupIcon[k?.type ?? PickupType.Random] ?? Texture.EMPTY);
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
        case 'playerDied': {
          // hide the body right away, even if the state saying alive=false is a patch behind
          this.players.get(e.player)?.kill(e.cause, e.killer ? this.playerPos(e.killer) : null);
          this.shakeAt(e.x, e.y, 0.4);
          this.recentDeaths.push({ x: e.x, y: e.y, t: this.time });
          if (this.recentDeaths.length > 16) this.recentDeaths.shift();
          break;
        }
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
          const z = e as unknown as { type: string; ring?: number; inset?: number; };
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
  setViewInset(left: number): void;
  transition(kind?: 'travel' | 'snap'): void;
  prime(events: GameEvent[]): void;
  /** Leave the map on show now (connecting): the camera sets off into the countryside, see PixiRenderer. */
  depart(): void;
  /** Where the sound is heard from (camera centre in the current map's tiles, presence 0..1). */
  listener(): { x: number; y: number; presence: number; } | null;
  /** While the loader runs: textures onto the GPU, and the first map's trip drawn ahead (see PixiRenderer). */
  preload(world: WorldState | null, onProgress?: (done: number) => void): Promise<void>;
  /** Called when a camera travel to a new map starts: duration and unit direction (world). */
  onTravel?: (durationMs: number, dx: number, dy: number) => void;
  /** Teleport moments for sound: a frozen hero beams out, a hero drops in on a new map (tiles). */
  onTeleport?: (kind: 'beamOut' | 'dropIn', x: number, y: number, who: string, crowd?: number) => void;
  /** Storm lightning, for the thunder: it should be heard `delaySec` later. */
  onThunder?: (delaySec: number, power: number) => void;
}

/** Every texture source reachable from these objects (asset sheets, procedural textures). */
function textureSources(roots: unknown[]) {
  const out = new Set<TextureSource>();
  const seen = new Set<object>();
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (v instanceof Texture) { out.add(v.source); return; }
    if (v instanceof TextureSource) { out.add(v); return; }
    if (v instanceof Container || ArrayBuffer.isView(v) || v instanceof Node) return;
    for (const x of v instanceof Map ? v.values() : Array.isArray(v) ? v : Object.values(v)) walk(x);
  };
  roots.forEach(walk);
  return out;
}

/** A trip's direction (radians) and the stretch of countryside (tiles) it keeps clear at least. */
interface TripDir { ang: number; gap: number }

const mapKey = (m: { ox: number; oy: number; w: number; h: number; }) => `${m.ox},${m.oy},${m.w},${m.h}`;

/** A random direction away from map `m`; far from the start, roughly back towards it (no wandering off forever). */
function tripDir(m: { ox: number; oy: number; w: number; h: number; }): TripDir {
  const cx = m.ox + (m.w - 1) / 2, cy = m.oy + (m.h - 1) / 2;
  const ang = Math.hypot(cx, cy) > 400 ? Math.atan2(-cy, -cx) + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2;
  return { ang, gap: 28 + Math.random() * 14 };
}

/** Where the next map goes: the way `dir` from the old one, clear of it by a stretch of countryside,
 *  centres at least `min` tiles apart. */
function nextOrigin(m: { ox: number; oy: number; w: number; h: number; }, w: number, h: number, min: number, dir: TripDir): [number, number] {
  const cx = m.ox + (m.w - 1) / 2, cy = m.oy + (m.h - 1) / 2;
  const dx = Math.cos(dir.ang), dy = Math.sin(dir.ang);
  const gap = dir.gap;
  const hw = (m.w + w) / 2 + 2 + gap, hh = (m.h + h) / 2 + 2 + gap;
  const t = Math.max(min, Math.min(Math.abs(dx) > 1e-3 ? hw / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-3 ? hh / Math.abs(dy) : Infinity));
  return [Math.round(cx + dx * t - (w - 1) / 2), Math.round(cy + dy * t - (h - 1) / 2)];
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
    background: 0x839f7c, // the countryside's grass: no dark frame before the ground is drawn
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
  // the canvas goes in only once there's something to draw: until then the stage's own grass
  // background shows (no black box while the textures load)
  const assets = await loadAssets();
  installFonts();
  const tx = makeTextures();
  const renderer = new PixiRenderer(app, parent, assets, tx, quality);
  // and it fades in a moment later, once the nearest countryside chunks have been drawn
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity 0.8s ease-out';
  parent.appendChild(canvas);
  setTimeout(() => { canvas.style.opacity = '1'; }, 250);
  return renderer;
};

export default createRenderer;
const _check: CreateRenderer = createRenderer;
void _check;
