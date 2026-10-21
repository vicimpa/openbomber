// Loads the Aseprite atlases (Pixi spritesheet JSON + PNG) and derives the textures the views need.
import { Assets, Rectangle, Spritesheet, Texture, TextureSource, type SpritesheetData } from 'pixi.js';

import worldJson from '../assets/world/world.json';
import worldPng from '../assets/world/world.png';
import bombsJson from '../assets/bombs/bombs.json';
import bombsPng from '../assets/bombs/bombs.png';
import pickupsJson from '../assets/pickups/pickups.json';
import pickupsPng from '../assets/pickups/pickups.png';
import explodeJson from '../assets/explode/explode.json';
import explodePng from '../assets/explode/explode.png';
import fireJson from '../assets/fire/fire.json';
import firePng from '../assets/fire/fire.png';
import terrainPng from '../assets/world/terrain.png';
import ruinesJson from '../assets/ruines/ruines.json';
import ruinesPng from '../assets/ruines/ruines.png';
import dustJson from '../assets/dust/dust.json';
import dustPng from '../assets/dust/dust.png';
import shieldJson from '../assets/effects/shield.json';
import shieldPng from '../assets/effects/shield.png';
import fxFireJson from '../assets/effects/fire.json';
import fxFirePng from '../assets/effects/fire.png';
import crazyJson from '../assets/effects/crazy.json';
import crazyPng from '../assets/effects/crazy.png';
import kickingJson from '../assets/effects/kicking.json';
import kickingPng from '../assets/effects/kicking.png';
import monocraftUrl from '../assets/fonts/Monocraft/Monocraft.woff2';

import { PickupType } from '@ob/game';

const heroJson = import.meta.glob('../assets/heroes/type*.json', { eager: true, import: 'default' }) as Record<string, SpritesheetData>;
const heroPng = import.meta.glob('../assets/heroes/type*.png', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

TextureSource.defaultOptions.scaleMode = 'nearest';

export type Tags = Record<string, Texture[]>;

async function sheet(data: unknown, url: string): Promise<Record<string, Texture>> {
  const tex = await Assets.load<Texture>(url);
  tex.source.scaleMode = 'nearest';
  const s = new Spritesheet(tex, data as SpritesheetData);
  return await s.parse();
}

/** The prototype's scorch tileset: frames are a plain array (5x4 grid, 32 px). */
async function frameList(data: { frames: { frame: { x: number; y: number; w: number; h: number } }[] }, url: string): Promise<Texture[]> {
  const tex = await Assets.load<Texture>(url);
  tex.source.scaleMode = 'nearest';
  return data.frames.map(({ frame: f }) => new Texture({ source: tex.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }));
}

/** Groups `tag:index` frame names into ordered arrays. */
function tags(frames: Record<string, Texture>): Tags {
  const out: Record<string, [number, Texture][]> = {};
  for (const [k, t] of Object.entries(frames)) {
    const i = k.lastIndexOf(':');
    const tag = i < 0 ? '' : k.slice(0, i);
    const n = i < 0 ? Number(k) : Number(k.slice(i + 1));
    (out[tag] ??= []).push([n, t]);
  }
  const res: Tags = {};
  for (const [k, v] of Object.entries(out)) res[k] = v.sort((a, b) => a[0] - b[0]).map(e => e[1]);
  return res;
}

/** Slice each 160x160 (5x5 tile) explosion frame into 32px cells, honouring the trim. */
function sliceExplode(data: typeof explodeJson, tex: Texture, tag: string): Texture[][][] {
  const frames = Object.entries(data.frames)
    .filter(([k]) => k.startsWith(tag + ':'))
    .sort((a, b) => Number(a[0].split(':')[1]) - Number(b[0].split(':')[1]));
  return frames.map(([, f]) => {
    const cells: Texture[][] = [];
    for (let cy = 0; cy < 5; cy++) {
      const row: Texture[] = [];
      for (let cx = 0; cx < 5; cx++) {
        const rx = cx * 32, ry = cy * 32;
        const sx = f.spriteSourceSize.x, sy = f.spriteSourceSize.y;
        const ix0 = Math.max(rx, sx), iy0 = Math.max(ry, sy);
        const ix1 = Math.min(rx + 32, sx + f.frame.w), iy1 = Math.min(ry + 32, sy + f.frame.h);
        if (ix1 <= ix0 || iy1 <= iy0) { row.push(Texture.EMPTY); continue; }
        row.push(new Texture({
          source: tex.source,
          frame: new Rectangle(f.frame.x + ix0 - sx, f.frame.y + iy0 - sy, ix1 - ix0, iy1 - iy0),
          orig: new Rectangle(0, 0, 32, 32),
          trim: new Rectangle(ix0 - rx, iy0 - ry, ix1 - ix0, iy1 - iy0),
        }));
      }
      cells.push(row);
    }
    return cells;
  });
}

export const PICKUP_FRAME: Record<PickupType, string> = Object.fromEntries(
  Object.keys(PickupType).filter(k => isNaN(Number(k))).map(k => [PickupType[k as keyof typeof PickupType], k]),
) as Record<PickupType, string>;

export const FONT = 'Monocraft';

export async function loadAssets() {
  const [world, bombs, pickups, explodeTex, fire, terrain, dust, shield, fxFire, crazy, kicking, ruines] = await Promise.all([
    sheet(worldJson, worldPng),
    sheet(bombsJson, bombsPng).then(tags),
    sheet(pickupsJson, pickupsPng),
    Assets.load<Texture>(explodePng),
    sheet(fireJson, firePng).then(tags),
    Assets.load<Texture>(terrainPng),
    sheet(dustJson, dustPng).then(tags),
    sheet(shieldJson, shieldPng).then(tags),
    sheet(fxFireJson, fxFirePng).then(tags),
    sheet(crazyJson, crazyPng).then(f => tags(f)['']),
    sheet(kickingJson, kickingPng).then(f => tags(f)['']),
    frameList(ruinesJson, ruinesPng),
  ]);
  const heroes: Tags[] = [];
  for (let i = 1; i <= Object.keys(heroJson).length; i++) {
    const key = `../assets/heroes/type${i}`;
    heroes.push(tags(await sheet(heroJson[key + '.json'], heroPng[key + '.png'])));
  }
  const pickupTags = tags(pickups);
  const pickupIcon = {} as Record<PickupType, Texture>;
  for (const [type, name] of Object.entries(PICKUP_FRAME)) pickupIcon[Number(type) as PickupType] = pickups[name];

  try {
    const face = new FontFace(FONT, `url(${monocraftUrl})`);
    await face.load();
    document.fonts.add(face);
  } catch (e) {
    console.warn('[render] font failed to load', e);
  }

  return {
    world: world as Record<'grass' | 'grass2' | 'box' | 'wall', Texture>,
    bombs,
    pickupIcon,
    blink: pickupTags['blink'],
    explode: sliceExplode(explodeJson, explodeTex, 'normal'),
    explodeFake: sliceExplode(explodeJson, explodeTex, 'fake'),
    fire,
    terrain,
    dust,
    shield,
    fxFire,
    crazy,
    kicking,
    ruines,
    heroes,
  };
}

export type GameAssets = Awaited<ReturnType<typeof loadAssets>>;
