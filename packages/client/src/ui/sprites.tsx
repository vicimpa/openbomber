// DOM-side sprite helpers: animated hero previews (small canvas per sprite, one shared rAF
// ticker) and static pickup icons (CSS background-position into the bonuses atlas).
import type { PickupType } from '@ob/game';
import { useEffect, useRef } from 'preact/hooks';
import bonusesJson from '$/assets/bonuses/bonuses.json';
import bonusesPng from '$/assets/bonuses/bonuses.png';
import { PICKUP_BY_TYPE } from './pickups';

interface AseFrame {
  frame: { x: number; y: number; w: number; h: number };
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  duration: number;
}
interface AseJson { frames: Record<string, AseFrame>; meta: { size: { w: number; h: number } } }

const heroJson = import.meta.glob<AseJson>('../assets/heroes/type*.json', { eager: true, import: 'default' });
const heroPng = import.meta.glob<string>('../assets/heroes/type*.png', { eager: true, query: '?url', import: 'default' });

const num = (p: string) => Number(/type(\d+)\./.exec(p)?.[1] ?? 0);
const skins = Object.keys(heroJson)
  .sort((a, b) => num(a) - num(b))
  .map((k) => ({ json: heroJson[k], png: heroPng[k.replace('.json', '.png')] }));

export const HERO_SKINS = skins.length;

export type HeroAnim = 'IdleDown' | 'IdleUp' | 'IdleRight' | 'RunDown' | 'RunUp' | 'RunRight'
  | 'IdleDownBomb' | 'RunDownBomb' | 'RunRightBomb';

/** Crop of the 64×64 source cell that contains every hero pose. */
const CROP = { x: 14, y: 9, w: 36, h: 40 };

const images = new Map<string, HTMLImageElement>();
function image(url: string) {
  let img = images.get(url);
  if (!img) { img = new Image(); img.src = url; images.set(url, img); }
  return img;
}

function framesOf(json: AseJson, tag: string): AseFrame[] {
  const out: AseFrame[] = [];
  for (let i = 0; json.frames[`${tag}:${i}`]; i++) out.push(json.frames[`${tag}:${i}`]);
  return out;
}

// ---- shared ticker
const tickers = new Set<(now: number) => void>();
let raf = 0;
const loop = (now: number) => {
  tickers.forEach((f) => f(now));
  raf = tickers.size ? requestAnimationFrame(loop) : 0;
};
function addTicker(f: (now: number) => void) {
  tickers.add(f);
  if (!raf) raf = requestAnimationFrame(loop);
  return () => { tickers.delete(f); };
}

const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface HeroSpriteProps {
  skin: number;
  anim?: HeroAnim;
  /** Mirror horizontally (Run/Idle Right → Left). */
  flip?: boolean;
  /** CSS pixels per sprite pixel. */
  scale?: number;
  /** Freeze on the first frame. */
  still?: boolean;
  class?: string;
  title?: string;
}

export function HeroSprite({ skin, anim = 'IdleDown', flip, scale = 2, still, class: cls, title }: HeroSpriteProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const s = skins[((skin % skins.length) + skins.length) % skins.length];

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !s) return;
    const ctx = cv.getContext('2d')!;
    const img = image(s.png);
    const frames = framesOf(s.json, anim);
    if (!frames.length) return;
    const start = performance.now();
    let last = -1;
    const total = frames.reduce((a, f) => a + f.duration, 0);
    const draw = (now: number) => {
      if (!img.complete || !img.naturalWidth) return;
      let idx = 0;
      if (!still && !reducedMotion) {
        let t = (now - start) % total;
        while (t >= frames[idx].duration && idx < frames.length - 1) { t -= frames[idx].duration; idx++; }
      }
      if (idx === last) return;
      last = idx;
      const f = frames[idx];
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, f.frame.x, f.frame.y, f.frame.w, f.frame.h,
        f.spriteSourceSize.x - CROP.x, f.spriteSourceSize.y - CROP.y, f.frame.w, f.frame.h);
    };
    if (still || reducedMotion) {
      if (img.complete) draw(0); else img.addEventListener('load', () => draw(0), { once: true });
      return;
    }
    return addTicker(draw);
  }, [s, anim, still]);

  return (
    <canvas
      ref={ref}
      class={`hero-sprite ${cls ?? ''}`}
      width={CROP.w}
      height={CROP.h}
      title={title}
      role={title ? 'img' : undefined}
      aria-label={title}
      style={{ width: `${CROP.w * scale}px`, height: `${CROP.h * scale}px`, transform: flip ? 'scaleX(-1)' : undefined }}
    />
  );
}

// ---- pickup icons
const bonuses = bonusesJson as unknown as AseJson;

export interface PickupIconProps { type: PickupType; size?: number; class?: string; title?: string }

export function PickupIcon({ type, size = 32, class: cls, title }: PickupIconProps) {
  const info = PICKUP_BY_TYPE.get(type);
  const f = info?.sprite ? bonuses.frames[`${info.sprite}:0`] : undefined;
  if (f) {
    const k = size / f.frame.w;
    return (
      <span
        class={`pickup-icon ${cls ?? ''}`}
        title={title}
        role="img"
        aria-label={title ?? info?.name.en}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundImage: `url(${bonusesPng})`,
          backgroundPosition: `${-f.frame.x * k}px ${-f.frame.y * k}px`,
          backgroundSize: `${bonuses.meta.size.w * k}px ${bonuses.meta.size.h * k}px`,
        }}
      />
    );
  }
  // TODO(render): placeholder until the renderer exports icons for the new pickup types.
  return (
    <span
      class={`pickup-icon pickup-icon--emoji ${cls ?? ''}`}
      title={title}
      role="img"
      aria-label={title ?? info?.name.en}
      style={{ width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.55}px`, '--pc': info?.color ?? '#555' }}
    >
      {info?.emoji ?? '?'}
    </span>
  );
}
