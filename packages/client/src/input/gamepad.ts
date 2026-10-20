import { PAD, PAD_BINDINGS, STICK_DEADZONE } from './bindings';
import { markDevice } from './device';

export function pads(): Gamepad[] {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
  try {
    return navigator.getGamepads().filter((p): p is Gamepad => !!p && p.connected);
  } catch {
    return [];
  }
}

/** Radial deadzone with rescale, so small stick drift is ignored but full range stays 0..1. */
export function radial(x: number, y: number, dz = STICK_DEADZONE): [number, number] {
  const m = Math.hypot(x, y);
  if (m < dz) return [0, 0];
  const k = Math.min(1, (m - dz) / (1 - dz)) / m;
  return [x * k, y * k];
}

const pressed = (p: Gamepad, i: number) => !!p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5);

export function readGamepads() {
  let dx = 0, dy = 0, bomb = false, action = false;
  for (const p of pads()) {
    let [x, y] = radial(p.axes[0] ?? 0, p.axes[1] ?? 0);
    const px = +pressed(p, PAD.Right) - +pressed(p, PAD.Left);
    const py = +pressed(p, PAD.Down) - +pressed(p, PAD.Up);
    if (px || py) { x = px; y = py; }
    const b = PAD_BINDINGS.bomb.some((i) => pressed(p, i));
    const a = PAD_BINDINGS.action.some((i) => pressed(p, i));
    if (x || y || a || b) markDevice('gamepad');
    dx += x; dy += y; bomb ||= b; action ||= a;
  }
  return { dx, dy, bomb, action };
}

export function isPadPressed(p: Gamepad, i: number) { return pressed(p, i); }
