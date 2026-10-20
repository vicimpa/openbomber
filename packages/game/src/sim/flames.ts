// Explosions: flame propagation, shapes for the renderer, bricks, chain reactions.

import { CHAIN_DELAY, FLAME_TIME } from '../contract/constants';
import { Dir, DIR_VEC, FlameShape, Tile, type BombState, type FlameState } from '../contract/types';
import { emit, type SimCtx } from './context';
import { pickupAt, spawnPickup } from './pickups';
import { bombIsGrounded } from './world';

const END_SHAPE: Record<Dir, FlameShape> = {
  [Dir.Up]: FlameShape.EndUp,
  [Dir.Left]: FlameShape.EndLeft,
  [Dir.Right]: FlameShape.EndRight,
  [Dir.Down]: FlameShape.EndDown,
};
const DIRS = [Dir.Up, Dir.Left, Dir.Right, Dir.Down] as const;

const isHorizontal = (s: FlameShape) => s === FlameShape.Horizontal || s === FlameShape.EndLeft || s === FlameShape.EndRight;

/** Combine two flame shapes on the same tile (crossing flames become a Center). */
export function mergeShape(a: FlameShape, b: FlameShape): FlameShape {
  if (a === b) return a;
  if (a === FlameShape.Center || b === FlameShape.Center) return FlameShape.Center;
  const ha = isHorizontal(a);
  if (ha !== isHorizontal(b)) return FlameShape.Center;
  return ha ? FlameShape.Horizontal : FlameShape.Vertical;
}

export function addFlame(ctx: SimCtx, x: number, y: number, shape: FlameShape, owner: string) {
  const w = ctx.world;
  const idx = y * w.width + x;
  const existing = ctx.flameGrid[idx] ? w.flames.get(ctx.flameGrid[idx]!) : undefined;
  if (existing) {
    existing.shape = mergeShape(existing.shape, shape);
    existing.ttl = FLAME_TIME;
    existing.owner = owner;
    return;
  }
  const f: FlameState = { id: w.nextId++, x, y, shape, owner, ttl: FLAME_TIME };
  w.flames.set(f.id, f);
  ctx.flameGrid[idx] = f.id;
}

/** Make a bomb go off after CHAIN_DELAY (unless it is already about to); `credit` gets its kills. */
export function chainBomb(ctx: SimCtx, b: BombState, credit: string) {
  if (b.fuse > 0 && b.fuse <= CHAIN_DELAY) return;
  b.fuse = CHAIN_DELAY;
  const bi = ctx.bombs.get(b.id);
  if (bi) bi.credit = credit;
}

export function destroyBrick(ctx: SimCtx, x: number, y: number) {
  const w = ctx.world;
  const idx = y * w.width + x;
  w.tiles[idx] = Tile.Floor;
  ctx.brickBurn[idx] = FLAME_TIME;
  ctx.brickBurnCount++;
  emit(ctx, { type: 'brickDestroyed', x, y });
  const hidden = ctx.hidden[idx]!;
  if (hidden >= 0) {
    ctx.hidden[idx] = -1;
    spawnPickup(ctx, x, y, hidden);
  }
}

/** Age flames and burning-brick markers. */
export function tickFlames(ctx: SimCtx) {
  const w = ctx.world;
  for (const f of w.flames.values()) {
    if (--f.ttl > 0) continue;
    w.flames.delete(f.id);
    const idx = f.y * w.width + f.x;
    if (ctx.flameGrid[idx] === f.id) ctx.flameGrid[idx] = 0;
  }
  if (ctx.brickBurnCount > 0) {
    let n = 0;
    const bb = ctx.brickBurn;
    for (let i = 0; i < bb.length; i++) if (bb[i]! > 0 && --bb[i]! > 0) n++;
    ctx.brickBurnCount = n;
  }
}

/** Burn a pickup on the tile if it is no longer protected (the flame goes on through it, as in legacy). */
function hitPickup(ctx: SimCtx, x: number, y: number) {
  const k = pickupAt(ctx, x, y);
  if (!k || k.protect > 0) return;
  ctx.world.pickups.delete(k.id);
  emit(ctx, { type: 'pickupBurned', pickup: k.id, x, y });
}

/** A live player stands on the tile: their body takes the blast and shields whoever is behind. */
function playerOn(ctx: SimCtx, x: number, y: number): boolean {
  for (const p of ctx.world.players.values()) {
    if (p.alive && p.inRound && Math.round(p.x) === x && Math.round(p.y) === y) return true;
  }
  return false;
}

/** Grounded bomb on a tile via ctx.bombGrid (exploded ones have left the map). */
function gridBomb(ctx: SimCtx, x: number, y: number): BombState | undefined {
  const w = ctx.world;
  const b = w.bombs.get(ctx.bombGrid[y * w.width + x]!);
  return b && bombIsGrounded(b) && Math.round(b.x) === x && Math.round(b.y) === y ? b : undefined;
}

/** Detonate a bomb (already removed from the world by the caller). Uses ctx.bombGrid. */
export function explode(ctx: SimCtx, b: BombState, pierce: boolean, credit: string) {
  const w = ctx.world;
  const bx = Math.round(b.x);
  const by = Math.round(b.y);
  if (b.dud) {
    emit(ctx, { type: 'bombFizzled', bomb: b.id, x: bx, y: by });
    return;
  }
  const cells: { x: number; y: number; shape: FlameShape }[] = [];
  if (bx >= 0 && by >= 0 && bx < w.width && by < w.height) {
    cells.push({ x: bx, y: by, shape: FlameShape.Center });
    hitPickup(ctx, bx, by);
    const other = gridBomb(ctx, bx, by);
    if (other) chainBomb(ctx, other, credit);
  }
  for (const d of DIRS) {
    const [dx, dy] = DIR_VEC[d];
    const mid = dx !== 0 ? FlameShape.Horizontal : FlameShape.Vertical;
    const start = cells.length;
    for (let i = 1; i <= b.radius; i++) {
      const x = bx + dx * i;
      const y = by + dy * i;
      if (x < 0 || y < 0 || x >= w.width || y >= w.height) break;
      const idx = y * w.width + x;
      const t = w.tiles[idx];
      if (t === Tile.Wall) break;
      let stop = false;
      if (t === Tile.Brick) {
        destroyBrick(ctx, x, y);
        stop = !pierce;
      } else if (ctx.brickBurn[idx]! > 0 && !pierce) {
        stop = true; // a brick destroyed a moment ago still soaks up the flame
      }
      hitPickup(ctx, x, y);
      if (!pierce && playerOn(ctx, x, y)) stop = true;
      const other = gridBomb(ctx, x, y);
      if (other) {
        chainBomb(ctx, other, credit);
        stop = true;
      }
      cells.push({ x, y, shape: mid });
      if (stop) break;
    }
    if (cells.length > start) cells[cells.length - 1]!.shape = END_SHAPE[d];
  }
  for (const c of cells) addFlame(ctx, c.x, c.y, c.shape, credit);
  emit(ctx, { type: 'explosion', bomb: b.id, owner: credit, x: bx, y: by, cells, power: b.radius });
}
