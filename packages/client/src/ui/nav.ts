// Keyboard + gamepad navigation for menus and modals: arrows / d-pad / stick move focus
// spatially, Enter / A activates, Esc / B goes back. In the game screen (no modal open) it
// stays out of the way so arrows drive the hero; Start opens the menu drawer, Back holds
// the scoreboard.
import { isPadPressed, pads } from '$/input/gamepad';
import { PAD } from '$/input/bindings';
import { markDevice } from '$/input/device';
import { closeModal, modals, menuOpen, scoreboardOpen, screen, chatOpen } from './store';

type Dir = 'up' | 'down' | 'left' | 'right';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function navRoot(): HTMLElement | null {
  const roots = document.querySelectorAll<HTMLElement>('[data-nav-root]');
  return roots[roots.length - 1] ?? null;
}

function visible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

export function focusables(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[inert]') && visible(el));
}

function setKbdMode(on: boolean) {
  document.documentElement.toggleAttribute('data-kbd', on);
}

export function moveFocus(dir: Dir): boolean {
  const root = navRoot();
  if (!root) return false;
  const items = focusables(root);
  if (!items.length) return false;
  const cur = document.activeElement as HTMLElement | null;
  if (!cur || !root.contains(cur) || cur === document.body) {
    (root.querySelector<HTMLElement>('[data-autofocus]') ?? items[0]).focus();
    return true;
  }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best: HTMLElement | null = null, bestScore = Infinity;
  for (const el of items) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    let main: number, cross: number;
    switch (dir) {
      case 'down': main = b.top - a.bottom; cross = Math.abs(bx - ax); if (by <= ay + 1) continue; break;
      case 'up': main = a.top - b.bottom; cross = Math.abs(bx - ax); if (by >= ay - 1) continue; break;
      case 'right': main = b.left - a.right; cross = Math.abs(by - ay); if (bx <= ax + 1) continue; break;
      case 'left': main = a.left - b.right; cross = Math.abs(by - ay); if (bx >= ax - 1) continue; break;
    }
    const score = Math.max(0, main) + cross * 2.2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) {
    best.focus();
    best.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    return true;
  }
  return false;
}

/** In the game with no modal open, arrows belong to gameplay. */
const inWorld = () => screen.value === 'game' || screen.value === 'menu';
const menuActive = () => !inWorld() || modals.value.length > 0 || menuOpen.value;

function isTextLike(el: Element | null) {
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'range', 'button', 'submit'].includes(el.type));
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Tab') setKbdMode(true);
  if (!menuActive() || e.altKey || e.ctrlKey || e.metaKey) return;
  const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as Record<string, Dir>)[e.key];
  if (!dir) return;
  const active = document.activeElement;
  // Let text fields keep caret movement and sliders keep their value keys.
  if (isTextLike(active) && (dir === 'left' || dir === 'right')) return;
  if (active instanceof HTMLInputElement && active.type === 'range' && (dir === 'left' || dir === 'right')) return;
  if (moveFocus(dir)) { setKbdMode(true); e.preventDefault(); }
}

function goBack() {
  if (modals.value.length) { closeModal(); return; }
  if (chatOpen.value) { chatOpen.value = false; return; }
  if (menuOpen.value) { menuOpen.value = false; return; }
  document.dispatchEvent(new CustomEvent('ui:back'));
}

// ---- gamepad polling for menus
const prevButtons = new Map<number, boolean[]>();
let repeatDir: Dir | null = null, repeatAt = 0;

function padDir(p: Gamepad): Dir | null {
  const x = p.axes[0] ?? 0, y = p.axes[1] ?? 0;
  if (isPadPressed(p, PAD.Up) || y < -0.6) return 'up';
  if (isPadPressed(p, PAD.Down) || y > 0.6) return 'down';
  if (isPadPressed(p, PAD.Left) || x < -0.6) return 'left';
  if (isPadPressed(p, PAD.Right) || x > 0.6) return 'right';
  return null;
}

function adjustRange(el: HTMLInputElement, sign: number) {
  const step = Number(el.step) || 1;
  const v = Math.min(Number(el.max), Math.max(Number(el.min), Number(el.value) + sign * step));
  el.value = String(v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function pollPads(now: number) {
  const list = pads();
  let dir: Dir | null = null;
  for (const p of list) {
    const prev = prevButtons.get(p.index) ?? [];
    const cur = p.buttons.map((_, i) => isPadPressed(p, i));
    const edge = (i: number) => cur[i] && !prev[i];
    prevButtons.set(p.index, cur);
    dir ??= padDir(p);

    if (inWorld() && !modals.value.length && !menuOpen.value) {
      if (edge(PAD.Start)) { markDevice('gamepad'); menuOpen.value = true; }
      if (!!cur[PAD.Back] !== !!prev[PAD.Back]) scoreboardOpen.value = !!cur[PAD.Back]; // hold
      continue;
    }
    if (edge(PAD.A)) {
      markDevice('gamepad'); setKbdMode(true);
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== document.body && navRoot()?.contains(el)) el.click();
      else moveFocus('down');
    }
    if (edge(PAD.B)) { markDevice('gamepad'); goBack(); }
    if (edge(PAD.Start)) { if (modals.value.length) closeModal(); else menuOpen.value = false; }
  }
  if (!menuActive()) { repeatDir = null; return; }
  if (dir) {
    const first = dir !== repeatDir;
    if (first || now >= repeatAt) {
      markDevice('gamepad'); setKbdMode(true);
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.type === 'range' && (dir === 'left' || dir === 'right')) adjustRange(el, dir === 'left' ? -1 : 1);
      else moveFocus(dir);
      repeatAt = now + (first ? 380 : 130);
    }
  }
  repeatDir = dir;
}

let installed = false;
export function installNav() {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('pointerdown', () => setKbdMode(false), { capture: true, passive: true });
  const loop = (now: number) => {
    if (!document.hidden && 'getGamepads' in navigator) pollPads(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
