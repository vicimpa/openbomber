// Input entry point: `createInput()` merges keyboard, gamepads and the touch overlay into one
// InputSample per frame. <TouchControls/> (./TouchControls.tsx) feeds the touch part and must
// be rendered by the game screen when `lastDevice.value === 'touch'`.
import { Button } from '@ob/game';
import type { CreateInput, InputManager, InputSample } from '$/contracts';
import { lastDevice } from './device';
import { readGamepads } from './gamepad';
import { vibrate } from './haptics';
import { KeyboardInput } from './keyboard';
import { touchState } from './touch';

export { lastDevice, isTouchDevice, markDevice } from './device';
export { inputPrefs } from './prefs';
export { vibrate } from './haptics';
export { installPlayGuards } from './guards';
export { canFullscreen, isFullscreen, toggleFullscreen, enterFullscreen, exitFullscreen } from './fullscreen';
export { KEY_BINDINGS, PAD_BINDINGS, keyLabel } from './bindings';

const ZERO: InputSample = { dx: 0, dy: 0, buttons: Button.None };

export const createInput: CreateInput = (): InputManager => {
  const keyboard = new KeyboardInput();
  let enabled = true;

  return {
    sample(): InputSample {
      if (!enabled) return { ...ZERO };
      const k = keyboard.read();
      const g = readGamepads();
      let dx = k.dx + g.dx + touchState.dx;
      let dy = k.dy + g.dy + touchState.dy;
      const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; }
      let buttons = Button.None;
      if (k.bomb || g.bomb || touchState.bomb) buttons |= Button.Bomb;
      if (k.action || g.action || touchState.action) buttons |= Button.Action;
      if (k.teleport || g.teleport || touchState.teleport) buttons |= Button.Teleport;
      return { dx, dy, buttons };
    },
    get lastDevice() { return lastDevice.value; },
    vibrate,
    setEnabled(v: boolean) {
      enabled = v;
      keyboard.enabled = v;
      if (!v) keyboard.reset();
    },
    dispose() { keyboard.dispose(); },
  };
};
