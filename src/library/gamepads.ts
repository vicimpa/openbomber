export const gamepadsStore = new Map<number, GamepadController>();

export class GamepadController {
  index = -1;

  name = '';

  axies: number[] = [];
  buttons: number[] = [];

  update(gamepad: Gamepad) {

  }
}

; (() => {
  const loop = () => {
    const gamepadState = navigator.getGamepads();

    for (const gamepad of gamepadState) {
      if (!gamepad) continue;
    }

    requestAnimationFrame(loop);
  };

  loop();
})();