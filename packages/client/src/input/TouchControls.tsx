// On-screen controls for touch devices: a floating analog joystick on one half of the screen
// and two big buttons (Bomb, Action) on the other. Multi-touch via Pointer Events.
//
// Mounting: the game screen renders <TouchControls .../> above the canvas and BELOW the
// interactive HUD layer when `lastDevice.value === 'touch'`. It writes into `touchState`
// (./touch.ts), which every InputManager from createInput() reads.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { vibrate } from './haptics';
import { resetTouch, touchState } from './touch';
import s from './TouchControls.module.css';

export interface TouchControlsProps {
  /** Scale of joystick and buttons, ~0.7..1.4 (1 = default). */
  size?: number;
  /** 0.2..1 */
  opacity?: number;
  /** Mirror: joystick on the right, buttons on the left. */
  leftHanded?: boolean;
  /** Labels for the buttons (localised by the caller). */
  bombLabel?: ComponentChildren;
  actionLabel?: ComponentChildren;
  bombTitle?: string;
  actionTitle?: string;
}

const STICK_RADIUS = 58;      // px at size 1 (knob travel)
const STICK_DEADZONE = 0.16;  // fraction of radius

type BtnName = 'bomb' | 'action';

export function TouchControls({ size = 1, opacity = 0.8, leftHanded = false, bombLabel = 'B', actionLabel = 'A', bombTitle = 'Bomb', actionTitle = 'Action' }: TouchControlsProps) {
  const stickZone = useRef<HTMLDivElement>(null);
  const btnZone = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const bombEl = useRef<HTMLDivElement>(null);
  const actionEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const zone = stickZone.current!, bz = btnZone.current!;
    const baseEl = base.current!, knobEl = knob.current!;
    const R = STICK_RADIUS * size;
    let stickId = -1, ox = 0, oy = 0;

    const setKnob = (x: number, y: number) => { knobEl.style.transform = `translate(${x}px, ${y}px)`; };
    const placeBase = (x: number, y: number) => {
      const r = zone.getBoundingClientRect();
      baseEl.style.left = `${x - r.left}px`;
      baseEl.style.top = `${y - r.top}px`;
    };
    const restBase = () => {
      baseEl.style.left = '';
      baseEl.style.top = '';
      baseEl.removeAttribute('data-active');
      setKnob(0, 0);
    };

    const stickMove = (x: number, y: number) => {
      let vx = (x - ox) / R, vy = (y - oy) / R;
      let m = Math.hypot(vx, vy);
      if (m > 1) {
        // Drag-follow: the base trails the thumb so direction changes stay instant.
        ox = x - (vx / m) * R; oy = y - (vy / m) * R;
        placeBase(ox, oy);
        vx /= m; vy /= m; m = 1;
      }
      setKnob(vx * R, vy * R);
      if (m < STICK_DEADZONE) { touchState.dx = 0; touchState.dy = 0; return; }
      const k = (m - STICK_DEADZONE) / (1 - STICK_DEADZONE) / m;
      touchState.dx = vx * k;
      touchState.dy = vy * k;
    };

    const onStickDown = (e: PointerEvent) => {
      if (stickId !== -1) return;
      e.preventDefault();
      stickId = e.pointerId;
      zone.setPointerCapture?.(e.pointerId);
      // Keep the whole base on screen.
      const pad = R + 12;
      ox = Math.min(Math.max(e.clientX, pad), innerWidth - pad);
      oy = Math.min(Math.max(e.clientY, pad), innerHeight - pad);
      placeBase(ox, oy);
      baseEl.setAttribute('data-active', '');
      stickMove(e.clientX, e.clientY);
      vibrate(6, 0.2);
    };
    const onStickMove = (e: PointerEvent) => { if (e.pointerId === stickId) stickMove(e.clientX, e.clientY); };
    const onStickUp = (e: PointerEvent) => {
      if (e.pointerId !== stickId) return;
      stickId = -1;
      touchState.dx = 0; touchState.dy = 0;
      restBase();
    };

    // ---- buttons: each pointer is bound to the button under it; sliding onto the other
    // button switches (classic arcade thumb roll), sliding off keeps the current one.
    const owners = new Map<number, BtnName>();
    const btns: [BtnName, HTMLDivElement][] = [['bomb', bombEl.current!], ['action', actionEl.current!]];
    const hit = (x: number, y: number, slack: number): BtnName | null => {
      let best: BtnName | null = null, bestD = Infinity;
      for (const [name, el] of btns) {
        const r = el.getBoundingClientRect();
        const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
        if (d < (r.width / 2) * slack && d < bestD) { best = name; bestD = d; }
      }
      return best;
    };
    const syncButtons = () => {
      const held = new Set(owners.values());
      for (const [name, el] of btns) {
        const was = touchState[name];
        const now = held.has(name);
        touchState[name] = now;
        if (now !== was) {
          el.toggleAttribute('data-down', now);
          if (now) vibrate(name === 'bomb' ? 14 : 10, 0.35);
        }
      }
    };
    const onBtnDown = (e: PointerEvent) => {
      const b = hit(e.clientX, e.clientY, 1.45);
      if (!b) return;
      e.preventDefault();
      bz.setPointerCapture?.(e.pointerId);
      owners.set(e.pointerId, b);
      syncButtons();
    };
    const onBtnMove = (e: PointerEvent) => {
      if (!owners.has(e.pointerId)) return;
      const b = hit(e.clientX, e.clientY, 1.1);
      if (b && b !== owners.get(e.pointerId)) { owners.set(e.pointerId, b); syncButtons(); }
    };
    const onBtnUp = (e: PointerEvent) => {
      if (owners.delete(e.pointerId)) syncButtons();
    };

    const resetAll = () => {
      stickId = -1; owners.clear(); restBase(); resetTouch();
      for (const [, el] of btns) el.removeAttribute('data-down');
    };

    zone.addEventListener('pointerdown', onStickDown);
    zone.addEventListener('pointermove', onStickMove);
    zone.addEventListener('pointerup', onStickUp);
    zone.addEventListener('pointercancel', onStickUp);
    bz.addEventListener('pointerdown', onBtnDown);
    bz.addEventListener('pointermove', onBtnMove);
    bz.addEventListener('pointerup', onBtnUp);
    bz.addEventListener('pointercancel', onBtnUp);
    window.addEventListener('blur', resetAll);
    document.addEventListener('visibilitychange', resetAll);
    return () => {
      zone.removeEventListener('pointerdown', onStickDown);
      zone.removeEventListener('pointermove', onStickMove);
      zone.removeEventListener('pointerup', onStickUp);
      zone.removeEventListener('pointercancel', onStickUp);
      bz.removeEventListener('pointerdown', onBtnDown);
      bz.removeEventListener('pointermove', onBtnMove);
      bz.removeEventListener('pointerup', onBtnUp);
      bz.removeEventListener('pointercancel', onBtnUp);
      window.removeEventListener('blur', resetAll);
      document.removeEventListener('visibilitychange', resetAll);
      resetTouch();
    };
  }, [size, leftHanded]);

  return (
    <div
      class={s.root}
      data-left={leftHanded ? '' : undefined}
      style={{ '--tc-size': String(size), '--tc-opacity': String(opacity) }}
      aria-hidden="true"
    >
      <div class={s.stickZone} ref={stickZone}>
        <div class={s.base} ref={base}>
          <div class={s.knob} ref={knob} />
        </div>
      </div>
      <div class={s.btnZone} ref={btnZone}>
        <div class={`${s.btn} ${s.action}`} ref={actionEl} title={actionTitle}><span>{actionLabel}</span></div>
        <div class={`${s.btn} ${s.bomb}`} ref={bombEl} title={bombTitle}><span>{bombLabel}</span></div>
      </div>
    </div>
  );
}
