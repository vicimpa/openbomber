import { Events } from "core/Events";
import { abs } from "core/math";
import getGamepadInfo from "gamepad-info";

interface IGampadButton {
  target: GamepadController;
  button: number;
}

interface IGamepadAxis {
  target: GamepadController;
  axis: number;
  value: number;
}

interface IGamepadChange {
  target: GamepadController;
  axises: number[];
  buttons: number[];
}

interface IGamepadEvents {
  connect: GamepadController;
  disconnect: GamepadController;
  change: IGamepadChange;

  buttonDown: IGampadButton;
  buttonUp: IGampadButton;

  axisDown: IGamepadAxis;
  axisUp: IGamepadAxis;
}

export const gamepadsStore = new Map<number, GamepadController>();
export const gamepadEvents = new Events<IGamepadEvents>();

export class GamepadController {
  accuracy = 0.5;

  index = -1;

  name = '';
  vendorId = '';
  vendor?: string;
  productId = '';

  axies: number[] = [];
  buttons: number[] = [];

  constructor(gamepad: Gamepad) {
    const info = getGamepadInfo(gamepad);
    this.index = gamepad.index;
    this.name = info.name;
    this.vendor = info.vendor;
    this.productId = info.productId;
    this.vendorId = info.vendorId;
    this.buttons = gamepad.buttons.map(_ => 0);
    this.axies = gamepad.axes.map(_ => 0);
  }

  update(axies: number[], buttons: number[]) {
    let hasChange = false;
    const changeObject: IGamepadChange = { target: this, axises: [], buttons: [] };

    for (let i = 0; i < axies.length; i++) {
      const a = abs(this.axies[i]) > this.accuracy;
      const b = abs(axies[i]) > this.accuracy;

      if (a !== b) {
        const event: IGamepadAxis = { target: this, axis: i, value: axies[i] };
        changeObject.axises.push(i);
        gamepadEvents.emit(b > a ? 'axisDown' : 'axisUp', event);
        hasChange = true;
      }
    }

    for (let i = 0; i < buttons.length; i++) {
      const a = this.buttons[i] > this.accuracy;
      const b = buttons[i] > this.accuracy;

      if (a !== b) {
        const event: IGampadButton = { target: this, button: i };
        changeObject.buttons.push(i);
        gamepadEvents.emit(b > a ? 'buttonDown' : 'buttonUp', event);
        hasChange = true;
      }
    }

    if (hasChange) {
      gamepadEvents.emit('change', changeObject);
    }

    this.axies = axies;
    this.buttons = buttons;
  }
}

(() => {
  const loop = () => {
    const gamepadState = navigator.getGamepads();
    const map = new Map(gamepadState.entries());

    for (const [id, gamepadInfo] of map) {
      if (!gamepadInfo) continue;
      if (!gamepadsStore.has(id)) {
        const gamepad = new GamepadController(gamepadInfo);
        gamepadsStore.set(id, gamepad);
        gamepadEvents.emit('connect', gamepad);
      }
    }

    for (const [id, gamepad] of gamepadsStore) {
      if (!map.get(id)) {
        gamepadsStore.delete(id);
        gamepadEvents.emit('disconnect', gamepad);
      }
    }

    for (const [id, gamepad] of map) {
      if (!gamepad) continue;
      const controller = gamepadsStore.get(id)!;
      controller.update([...gamepad.axes], gamepad.buttons.map(e => e.value));
    }

    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
})();