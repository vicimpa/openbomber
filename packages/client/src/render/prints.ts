// Footprints: walking heroes leave a trail of little pixel prints (left, right, left...) that
// fade away. They show the ground: deep and lasting in snow, sandy in the desert, mud when it
// rains, a faint trampled mark on dry grass.
import { CanvasSource, Container, Sprite, Texture } from 'pixi.js';
import { Theme, Tile, Weather, type WorldState } from '@ob/game';

const T = 32;
/** Tiles walked per print (two prints per footstep sound). */
const STRIDE = 0.35;
const MAX = 400;

interface Look { tint: number; alpha: number; life: number }

function look(theme: Theme, weather: Weather): Look {
  if (theme === Theme.Winter) return { tint: 0x7f8fae, alpha: 0.62, life: 14 };
  if (theme === Theme.Desert) return { tint: 0x9c8052, alpha: 0.45, life: 9 };
  if (weather === Weather.Rain || weather === Weather.Storm) return { tint: 0x4a3a2e, alpha: 0.42, life: 8 };
  if (theme === Theme.Autumn) return { tint: 0x7a5a26, alpha: 0.3, life: 5 };
  return { tint: 0x45603f, alpha: 0.26, life: 4 };
}

/** A 4x6 shoe print, sole and heel (white, tinted per ground), toes up. */
function soleTexture() {
  const rows = ['.##.', '####', '####', '.##.', '....', '.##.'];
  const c = document.createElement('canvas');
  c.width = 4; c.height = rows.length;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') g.fillRect(x, y, 1, 1); }));
  return new Texture({ source: new CanvasSource({ resource: c, scaleMode: 'nearest' }) });
}

interface Print { s: Sprite; age: number; life: number; alpha: number }

export class Footprints {
  readonly root = new Container();
  private tex = soleTexture();
  private prints: Print[] = [];
  private pool: Sprite[] = [];
  private walked = new Map<string, { x: number; y: number; acc: number; left: boolean }>();

  update(world: WorldState, dt: number) {
    const lk = look(world.theme, world.weather);
    for (const p of world.players.values()) {
      let s = this.walked.get(p.id);
      if (!s) { this.walked.set(p.id, { x: p.x, y: p.y, acc: 0, left: false }); continue; }
      const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy);
      const px = s.x, py = s.y;
      s.x = p.x; s.y = p.y;
      // dead, waiting, floating (ghost through a brick) or a jump (teleport / respawn / new map)
      if (!p.alive || !p.inRound || d > 1.5) { s.acc = 0; continue; }
      if (d < 1e-4) continue;
      s.acc += d;
      if (s.acc < STRIDE) continue;
      s.acc = Math.min(s.acc - STRIDE, STRIDE);
      const tx = Math.round(p.x), ty = Math.round(p.y);
      if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height || world.tiles[ty * world.width + tx] !== Tile.Floor) continue;
      s.left = !s.left;
      // a little to the side of the line walked, toes forward
      const ux = dx / d, uy = dy / d, side = s.left ? -3 : 3;
      this.add((px + dx) * T - uy * side, (py + dy) * T + 6 + ux * side, Math.atan2(uy, ux) + Math.PI / 2, lk);
    }
    if (this.walked.size > world.players.size + 8) for (const id of this.walked.keys()) if (!world.players.has(id)) this.walked.delete(id);

    for (let i = this.prints.length - 1; i >= 0; i--) {
      const pr = this.prints[i];
      pr.age += dt;
      const k = pr.age / pr.life;
      if (k >= 1) {
        pr.s.removeFromParent();
        this.pool.push(pr.s);
        this.prints[i] = this.prints[this.prints.length - 1];
        this.prints.pop();
        continue;
      }
      // hold, then fade in pixel-art steps
      pr.s.alpha = pr.alpha * (k < 0.6 ? 1 : Math.ceil((1 - k) / 0.4 * 3) / 3);
    }
  }

  private add(x: number, y: number, rot: number, lk: Look) {
    if (this.prints.length >= MAX) {
      // the oldest goes first
      let oldest = 0;
      for (let i = 1; i < this.prints.length; i++) if (this.prints[i].age > this.prints[oldest].age) oldest = i;
      this.prints[oldest].age = this.prints[oldest].life;
    }
    const s = this.pool.pop() ?? new Sprite({ texture: this.tex, anchor: 0.5 });
    s.x = Math.round(x); s.y = Math.round(y);
    // grid movement: snap to the four directions so the pixels stay crisp
    s.rotation = Math.round(rot / (Math.PI / 2)) * (Math.PI / 2);
    s.tint = lk.tint;
    s.alpha = lk.alpha;
    this.root.addChild(s);
    this.prints.push({ s, age: 0, life: lk.life, alpha: lk.alpha });
  }

  clear() {
    for (const pr of this.prints) { pr.s.removeFromParent(); this.pool.push(pr.s); }
    this.prints = [];
    this.walked.clear();
  }
}
