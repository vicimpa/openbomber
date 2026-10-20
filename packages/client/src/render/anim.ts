import { Sprite, Texture, type SpriteOptions } from 'pixi.js';

/** Frame animation on a sprite, advanced with real time (fps), looping. Port of new-openbomber Animation. */
export class Anim extends Sprite {
  frames: Texture[];
  fps: number;
  time = 0;
  frame = 0;
  /** Extra empty frames after the sequence (blink pauses). */
  gap = 0;

  constructor(frames: Texture[], fps: number, opts: Omit<SpriteOptions, 'texture'> = {}) {
    super({ anchor: 0.5, ...opts });
    this.frames = frames;
    this.fps = fps;
    this.texture = frames[0] ?? Texture.EMPTY;
  }

  setFrames(frames: Texture[], restartAt = -1) {
    if (frames === this.frames) return;
    this.frames = frames;
    if (restartAt >= 0) this.time = restartAt / Math.max(this.fps, 1e-6);
  }

  tick(dt: number) {
    if (!this.visible) { this.time = 0; return; }
    this.time += dt;
    const n = this.frames.length + this.gap;
    this.frame = n ? Math.floor(this.time * this.fps) % n : 0;
    this.texture = this.frames[this.frame] ?? Texture.EMPTY;
  }
}
