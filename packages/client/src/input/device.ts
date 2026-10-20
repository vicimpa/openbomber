// Tracks which device produced the last meaningful input. Shared by every InputManager and
// read reactively by the UI (which overlay / which hints to show).
import { signal } from '@preact/signals';
import type { InputDevice } from '$/contracts';

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** True on phones / tablets (primary pointer is a finger or the device reports touch points). */
export const isTouchDevice = coarse || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches);

export const lastDevice = signal<InputDevice>(coarse ? 'touch' : 'keyboard');

export function markDevice(device: InputDevice) {
  if (lastDevice.peek() !== device) lastDevice.value = device;
}

let installed = false;
/** Global listeners that flip `lastDevice` for touch / keyboard (gamepad is detected while polling). */
export function installDeviceTracking() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') markDevice('touch');
  }, { capture: true, passive: true });
  window.addEventListener('keydown', (e) => {
    if (!e.repeat && !e.metaKey && !e.ctrlKey) markDevice('keyboard');
  }, { capture: true, passive: true });
}
installDeviceTracking();
