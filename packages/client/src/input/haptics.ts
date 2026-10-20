import { pads } from './gamepad';
import { inputPrefs } from './prefs';

/**
 * Phone vibration + gamepad rumble. `pattern` follows navigator.vibrate: a duration or
 * [on, off, on, ...] in ms. `strength` (0..1) only affects gamepads.
 */
export function vibrate(pattern: number | number[], strength = 1) {
  if (!inputPrefs.haptics) return;
  const list = typeof pattern === 'number' ? [pattern] : pattern;
  if (!list.length) return;
  try { navigator.vibrate?.(list); } catch { /* blocked without user gesture */ }

  const mag = Math.max(0, Math.min(1, strength));
  for (const p of pads()) {
    const act = (p as Gamepad & { vibrationActuator?: GamepadHapticActuator }).vibrationActuator;
    if (!act?.playEffect) continue;
    let at = 0;
    list.forEach((ms, i) => {
      if (i % 2 === 0 && ms > 0)
        act.playEffect('dual-rumble', {
          startDelay: at,
          duration: ms,
          weakMagnitude: mag,
          strongMagnitude: mag * 0.75,
        }).catch(() => {});
      at += ms;
    });
  }
}
