import { Camera } from "./Camera";
import { Entity } from "./Entity";

export class Application {
  cameras = new Set<Camera>();
  children = new Set<Entity>();
  time = performance.now();
  work = false;

  constructor(autostart = true) {
    if (autostart) this.start();
  }

  start() {
    if (this.work) return;
    this.work = true;
    const tick = () => {
      this.loop();
      if (this.work)
        requestAnimationFrame(tick);
    };

    tick();
  }

  stop() {
    this.work = false;
  }

  loop() {
    this.update();
    this.render();
  }

  update() {
    const time = performance.now();
    const dtime = time - this.time;

    this.time = time;

    for (const cam of this.cameras)
      cam.update(dtime, time);

    for (const entity of this.children)
      entity.update(dtime, time);
  }

  render(children = this.children) {
    for (const cam of this.cameras) {
      if (this.children === children)
        cam.apply();

      for (const entity of children) {
        cam.ctx.save();
        cam.renderObject(entity);
        this.render(entity.children);
        cam.ctx.restore();
      }
    }
  }
}