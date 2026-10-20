// State written by <TouchControls/> and read by every InputManager.
export const touchState = {
  dx: 0,
  dy: 0,
  bomb: false,
  action: false,
  teleport: false,
};

export function resetTouch() {
  touchState.dx = 0;
  touchState.dy = 0;
  touchState.bomb = false;
  touchState.action = false;
  touchState.teleport = false;
}
