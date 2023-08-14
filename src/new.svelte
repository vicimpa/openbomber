<script lang="ts">
  import { Application } from "class/Application";
  import { Background } from "class/Background";
  import { Camera } from "class/Camera";
  import { Character } from "class/Character";
  import { onFrame } from "library/onFrame";
  import { onMount } from "svelte";

  let canvas: HTMLCanvasElement;

  const app = new Application(false);
  const back = new Background(256, 256);
  const character = new Character();
  let cam: Camera | undefined;

  onMount(() => {
    cam = new Camera(canvas, 8);

    cam.s = 2;
    app.cameras.add(cam);
    back.appendTo(app);
    character.cam = cam;
    character.appendTo(app);

    return () => {
      app.cameras.clear();
      app.children.clear();
      cam = undefined;
    };
  });

  onFrame((dtime) => {
    if (!cam) return;

    app.loop();
  });
</script>

<canvas bind:this={canvas} />
<div class="menu">
  <button on:click={() => character.newPosition()}>Generate</button>
  <button on:click={() => character.removePosition()}>Delete</button>
</div>

<style lang="sass">
  canvas
    width: 100%
    height: 100%
    image-rendering: pixelated
    position: absolute

  .menu
    width: 200px
    height: 50px
    position: absolute
    top: 10px
    background-color: rgba(100, 100, 100, .6)
    box-shadow: 0 0 20px rgb(200, 200, 200)
    border: 3px solid rgb(200, 200, 200)
    backdrop-filter: blur(10px)
    -webkit-backdrop-filter: blur(10px)
    border-radius: 30px
    overflow: hidden
    z-index: 1
    display: flex
    justify-content: center
    gap: 10px
</style>
