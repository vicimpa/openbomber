// Default bindings. Used by the input code and shown in the settings / how-to-play screens.

export const KEY_BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  bomb: ['Space', 'Enter', 'NumpadEnter'],
  action: ['KeyE', 'ShiftLeft', 'ShiftRight', 'KeyJ'],
} as const;

export type BindingName = keyof typeof KEY_BINDINGS;

/** Standard-mapping gamepad buttons. */
export const PAD = {
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, Back: 8, Start: 9,
  L3: 10, R3: 11, Up: 12, Down: 13, Left: 14, Right: 15,
} as const;

export const PAD_BINDINGS = {
  bomb: [PAD.A, PAD.RT],
  action: [PAD.B, PAD.X, PAD.RB],
} as const;

export const STICK_DEADZONE = 0.22;

/** Human readable key label for UI. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    Space: 'Space', Enter: 'Enter', NumpadEnter: 'Num Enter',
    ShiftLeft: 'Shift', ShiftRight: 'R-Shift', Tab: 'Tab', Escape: 'Esc',
  };
  return map[code] ?? code;
}
