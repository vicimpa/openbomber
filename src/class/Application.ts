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
  }

  runUpdate(children: Set<Entity>, dtime: number, time: number) {
    for (const entity of children) {
      entity.update(dtime, time);
      this.runUpdate(entity.children, dtime, time);
    }
  }

  runRender(children: Set<Entity>, cam: Camera) {
    for (const entity of children) {
      cam.ctx.save();
      cam.renderObject(entity);
      this.runRender(entity.children, cam);
      cam.ctx.restore();
    }
  }

  update() {
    const time = Date.now();
    const dtime = time - this.time;

    this.time = time;

    if (dtime > 30)
      return;

    this.runUpdate(this.cameras, dtime, time);
    this.runUpdate(this.children, dtime, time);
    this.render();
  }

  render() {
    for (const cam of this.cameras) {
      cam.apply();
      this.runRender(this.children, cam);
    }
  }
}