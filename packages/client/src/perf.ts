// On-device frame timing, on with `?perf` in the url: every half second one line of what the frames
// were spent on, in a corner of the screen (and the console), so a stutter on a phone can be pinned
// without a profiler attached. Off, every hook is a single boolean check.
//   fps    frames in the bucket (×2)        max   the longest frame, ms
//   sim    game source update (simulation / net interpolation)
//   gnd    countryside chunks generated (count / ms)
//   pixi   app.render(): drawing and texture uploads
//   rest   frame time not covered above, idle time included: GC, audio rendering, layout, the
//          browser itself; a long `max` with little sim / gnd / pixi points there (or at the GPU)
export const perfOn = typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf');

const BUCKET_MS = 500;
const LINES = 16;

const acc = { frames: 0, dt: 0, max: 0, sim: 0, gnd: 0, chunks: 0, pixi: 0 };
const lines: string[] = [];
let el: HTMLPreElement | null = null;
let t0 = 0, bucketStart = 0;

export const perfNow = () => (perfOn ? performance.now() : 0);

/** Add `ms` spent on `key` (and `n` items for counters) to the current bucket. */
export function perfAdd(key: 'sim' | 'gnd' | 'pixi', ms: number, n = 0) {
  if (!perfOn) return;
  acc[key] += ms;
  if (key === 'gnd') acc.chunks += n;
}

/** Call once per animation frame with its delta. */
export function perfFrame(dt: number) {
  if (!perfOn) return;
  const now = performance.now();
  if (!t0) { t0 = bucketStart = now; return; }
  acc.frames++; acc.dt += dt; acc.max = Math.max(acc.max, dt);
  if (now - bucketStart < BUCKET_MS) return;
  const f = (v: number) => v.toFixed(0).padStart(4);
  const rest = Math.max(0, acc.dt - acc.sim - acc.gnd - acc.pixi);
  const line = `${((bucketStart - t0) / 1000).toFixed(1).padStart(5)}s fps${f(acc.frames * 1000 / (now - bucketStart))} max${f(acc.max)}`
    + ` sim${f(acc.sim)} gnd${f(acc.gnd)}/${acc.chunks} pixi${f(acc.pixi)} rest${f(rest)}`;
  console.log('[perf]', line);
  lines.push(line);
  if (lines.length > LINES) lines.shift();
  if (!el) {
    el = document.createElement('pre');
    el.style.cssText = 'position:fixed;left:calc(4px + env(safe-area-inset-left));top:calc(40px + env(safe-area-inset-top));z-index:1000;margin:0;padding:4px 6px;'
      + 'background:rgba(0,0,0,.75);color:#9f9;font:10px/1.25 ui-monospace,monospace;pointer-events:none;white-space:pre';
    document.body.appendChild(el);
  }
  el.textContent = 'ms per 0.5 s\n' + lines.join('\n');
  Object.assign(acc, { frames: 0, dt: 0, max: 0, sim: 0, gnd: 0, chunks: 0, pixi: 0 });
  bucketStart = now;
}
