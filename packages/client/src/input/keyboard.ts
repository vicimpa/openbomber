import { KEY_BINDINGS, type BindingName } from './bindings';
import { markDevice } from './device';

const bound = new Map<string, BindingName>();
for (const [name, codes] of Object.entries(KEY_BINDINGS) as [BindingName, readonly string[]][])
  for (const code of codes) bound.set(code, name);

/** Focus is in something that consumes typing (chat, nickname, room code...). */
export function isTextTarget(el: EventTarget | Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement)
    return !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color'].includes(el.type);
  return false;
}

/** A modal dialog is open on top of the game: gameplay keys must not leak into it. */
export function isModalOpen(): boolean {
  return !!document.querySelector('[data-modal-open]');
}

export class KeyboardInput {
  private held = new Set<string>();
  enabled = true;

  private onDown = (e: KeyboardEvent) => {
    const name = bound.get(e.code);
    if (!name) return;
    if (!this.enabled || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTextTarget(e.target) || isModalOpen()) return;
    this.held.add(e.code);
    markDevice('keyboard');
    // Keep Space/Enter/arrows from scrolling the page or "clicking" a focused HUD button.
    e.preventDefault();
  };
  private onUp = (e: KeyboardEvent) => { this.held.delete(e.code); };
  private clear = () => { this.held.clear(); };
  private onVisibility = () => { if (document.hidden) this.held.clear(); };

  constructor() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private down(name: BindingName) {
    for (const code of KEY_BINDINGS[name]) if (this.held.has(code)) return true;
    return false;
  }

  read() {
    if (!this.enabled) return { dx: 0, dy: 0, bomb: false, action: false, teleport: false };
    let dx = +this.down('right') - +this.down('left');
    let dy = +this.down('down') - +this.down('up');
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    return { dx, dy, bomb: this.down('bomb'), action: this.down('action'), teleport: this.down('teleport') };
  }

  reset() { this.held.clear(); }

  dispose() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
