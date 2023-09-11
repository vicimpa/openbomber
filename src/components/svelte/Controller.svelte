<script lang="ts">
  import { Vec2 } from "@/Vec2";
  import { showDebug } from "data/debug";
  import { makeController, makeVectorController } from "library/makeController";
  import { onFrame } from "library/onFrame";
  import { beforeUpdate, onMount } from "svelte";
  import { createEventDispatcher } from "svelte";

  export let move = new Vec2();
  export let inGame = true;

  const dispatch = createEventDispatcher<{
    bomb: void;
  }>();

  let touch = 0;
  let ref: HTMLDivElement;
  let axis: HTMLDivElement;
  let point: HTMLDivElement;
  let bomb: HTMLDivElement;

  let startId: number | null = null;
  let startVec = new Vec2();
  let gamepads: Gamepad[] = [];

  const keyboardMove = new Vec2();
  const touchMove = new Vec2();
  const gamepadMove = new Vec2();

  const controller = makeVectorController(
    {
      keys: ["KeyW", "ArrowUp"],
      plus: [0, -1],
    },
    {
      keys: ["KeyA", "ArrowLeft"],
      plus: [-1, 0],
    },
    {
      keys: ["KeyD", "ArrowRight"],
      plus: [1, 0],
    },
    {
      keys: ["KeyS", "ArrowDown"],
      plus: [0, 1],
    }
  );

  const keys = makeController({
    bomb: ["Space", "Enter"],
  });

  const gamepad = makeController({
    bomb: [() => !!gamepads.find((e) => e.buttons[0].pressed)],
  });

  const filter = (x: number, y: number) => {
    if (!ref) return false;
    if (x > ref.offsetWidth * 0.5 || y < ref.offsetHeight * 0.3) return false;
    return true;
  };

  const max = 40;

  const updatePoint = (v: Vec2) => {
    if (point) {
      point.style.transform = `translateX(${v.x * max}px) translateY(${
        v.y * max
      }px)`;
    }
  };

  const unset = () => {
    keyboardMove.set(0);
    gamepadMove.set(0);
    touchMove.set(0);
  };

  const updateGamepads = () => {
    gamepads = navigator.getGamepads().filter((e) => e) as Gamepad[];
  };

  onMount(() => {
    updateGamepads();
    addEventListener("blur", unset);
    addEventListener("gamepadconnected", updateGamepads);
    addEventListener("gamepaddisconnected", updateGamepads);
    addEventListener("gotpointercapture", updateGamepads);

    return () => {
      removeEventListener("blur", unset);
      removeEventListener("gamepadconnected", updateGamepads);
      removeEventListener("gamepaddisconnected", updateGamepads);
      removeEventListener("gotpointercapture", updateGamepads);
    };
  });

  beforeUpdate(() => {
    if (!ref) return;

    ref.ontouchstart = (e) => {
      const move = touchMove;
      const { touches } = e;
      for (const { clientX, clientY, identifier, target } of touches) {
        if (bomb === target) {
          dispatch("bomb");
          continue;
        }

        if (!filter(clientX, clientY)) continue;
        if (startId !== null) continue;
        startId = identifier;
        startVec = new Vec2(clientX, clientY);
        if (axis) {
          axis.style.left = clientX - 60 + "px";
          axis.style.top = clientY - 60 + "px";
        }
        updatePoint(move);
      }
    };

    ref.ontouchmove = (e) => {
      const move = touchMove;
      const { touches } = e;
      e.preventDefault();
      for (const { clientX, clientY, identifier } of touches) {
        if (identifier !== startId) continue;
        const delta = new Vec2(clientX, clientY).minus(startVec);

        const limit = delta
          .cminLimit(-max)
          .maxLimit(max)
          .div(max)
          .normalize()
          .abs()
          .times(max);

        const newMove = delta
          .cminLimit(limit.times(-1))
          .maxLimit(limit.times(-1))
          .div(max);

        if (newMove.cabs().length() > 0.3) move.set(newMove);
        else move.set(0);
        updatePoint(move);
        move.round().normalize();
      }
    };

    ref.ontouchend = ({ touches }) => {
      if (startId === null) return;
      if (![...touches].find((e) => e.identifier === startId)) startId = null;
      const move = touchMove;
      move.set(0);
      updatePoint(move);
    };

    ref.oncontextmenu = (e) => e.preventDefault();
  });

  onFrame(() => {
    if (touch !== window.navigator.maxTouchPoints)
      touch = window.navigator.maxTouchPoints;

    if (startId === null) move.set(0);

    keyboardMove.set(controller().normalize());

    if (gamepads.length) {
      updateGamepads();
      for (const {
        axes: [x, y],
      } of gamepads) {
        const vec = new Vec2(x, y);
        vec.round().normalize();

        if (vec.length()) {
          gamepadMove.set(vec);
        } else {
          gamepadMove.set(0);
        }
      }

      gamepad.bomb.isSingle() && dispatch("bomb");
    }

    keys.bomb.isSingle() && dispatch("bomb");

    showDebug({
      keyboardMove,
      gamepadMove,
      touchMove,
    });

    if (keyboardMove.length()) move.set(keyboardMove);
    else if (gamepadMove.length()) move.set(gamepadMove);
    else if (touchMove.length()) move.set(touchMove);
    else move.set(0);
  });
</script>

<div bind:this={ref} class="touch">
  {#if touch && inGame}
    <div bind:this={axis} class="axis" data-show={startId !== null}>
      <div bind:this={point} class="point" />
    </div>
    <div bind:this={bomb} class="bomb">💣</div>
  {/if}
</div>

<style lang="sass">
  .touch
    z-index: 1
    font-size: 30px
    position: absolute
    top: 0
    left: 0
    right: 0
    bottom: 0
    user-select: none
    -webkit-user-select: none
    background-color: rgba(0,0,0,0.01)

    *
      user-select: none
      -webkit-user-select: none

    $axis: 120px
    $point: 30px

    .axis, .bomb, .point
      position: absolute
      background-color: rgb(100,100,100)
      opacity: 0.5
      border-radius: 100%

    .axis
      width: $axis
      height: $axis
      top: calc(100% - 50px - $axis)
      left: calc(50px)
      display: flex
      align-items: center
      justify-content: center
      transition: opacity 0.3s

      &[data-show="false"]
        opacity: .4

      .point
        opacity: .6
        width: $point
        height: $point
        position: relative
        background-color: #fff
        

    .bomb
      width: 80px
      height: 80px
      display: flex
      align-items: center
      justify-content: center
      font-size: 40px
      bottom: 70px
      right: 70px
</style>
