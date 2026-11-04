// On-screen controls for touch devices: a floating eight-way joystick on one half of the screen
// and separate Bomb, Grab, Punch, Detonate and Teleport buttons. Multi-touch via Pointer Events.
//
// Mounting: the game screen renders <TouchControls .../> above the canvas and BELOW the
// interactive HUD layer when `lastDevice.value === 'touch'`. It writes into `touchState`
// (./touch.ts), which every InputManager from createInput() reads.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { vibrate } from './haptics';
import { resetTouch, touchState } from './touch';
import { snapStick } from './stick';
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
  punchLabel?: ComponentChildren;
  detonateLabel?: ComponentChildren;
  bombTitle?: string;
  actionTitle?: string;
  punchTitle?: string;
  detonateTitle?: string;
  showPunch?: boolean;
  showDetonate?: boolean;
  available?: Partial<Record<BtnName, boolean>>;
  /** Teleport button: shown only while the hero holds charges (null = hidden). */
  teleportLabel?: ComponentChildren;
  teleportTitle?: string;
  showTeleport?: boolean;
}

const STICK_RADIUS = 58;      // px at size 1 (knob travel)

type BtnName = 'bomb' | 'action' | 'punch' | 'detonate' | 'teleport';

export function TouchControls({ size = 1, opacity = 0.8, leftHanded = false, bombLabel = 'B', actionLabel = 'E', punchLabel = 'F', detonateLabel = 'R', bombTitle = 'Bomb', actionTitle = 'Grab / throw', punchTitle = 'Punch', detonateTitle = 'Detonate', showPunch = false, showDetonate = false, available = {}, teleportLabel = 'T', teleportTitle = 'Teleport', showTeleport = false }: TouchControlsProps) {
  const stickZone = useRef<HTMLDivElement>(null);
  const btnZone = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const bombEl = useRef<HTMLDivElement>(null);
  const actionEl = useRef<HTMLDivElement>(null);
  const punchEl = useRef<HTMLDivElement>(null);
  const detonateEl = useRef<HTMLDivElement>(null);
  const teleportEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const zone = stickZone.current!, bz = btnZone.current!;
    const baseEl = base.current!, knobEl = knob.current!;
    const R = STICK_RADIUS * size;
    let stickId = -1, ox = 0, oy = 0;
    let direction = -1;

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
      baseEl.removeAttribute('data-direction');
      direction = -1;
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
      const input = snapStick(vx, vy, direction);
      direction = input.direction;
      touchState.dx = input.dx;
      touchState.dy = input.dy;
      if (direction < 0) {
        baseEl.removeAttribute('data-direction');
        setKnob(vx * R, vy * R);
      } else {
        baseEl.setAttribute('data-direction', String(direction));
        const half = direction % 2 ? 15 : 30;
        baseEl.style.setProperty('--stick-start', `${direction * 45 + 90 - half}deg`);
        baseEl.style.setProperty('--stick-span', `${half * 2}deg`);
        setKnob(input.dx * m * R, input.dy * m * R);
      }
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
    const btns: [BtnName, HTMLDivElement][] = [['bomb', bombEl.current!], ['action', actionEl.current!], ['punch', punchEl.current!], ['detonate', detonateEl.current!], ['teleport', teleportEl.current!]];
    const hit = (x: number, y: number, slack: number): BtnName | null => {
      let best: BtnName | null = null, bestD = Infinity;
      for (const [name, el] of btns) {
        if (el.hidden) continue;
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
        const now = held.has(name) && !el.hidden;
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
    zone.addEventListener('lostpointercapture', onStickUp);
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
      zone.removeEventListener('lostpointercapture', onStickUp);
      bz.removeEventListener('pointerdown', onBtnDown);
      bz.removeEventListener('pointermove', onBtnMove);
      bz.removeEventListener('pointerup', onBtnUp);
      bz.removeEventListener('pointercancel', onBtnUp);
      window.removeEventListener('blur', resetAll);
      document.removeEventListener('visibilitychange', resetAll);
      resetAll();
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
        <div class={`${s.btn} ${s.action}`} ref={actionEl} title={actionTitle} data-unavailable={available.action === false ? '' : undefined}><span>{actionLabel}</span></div>
        <div class={`${s.btn} ${s.punch}`} ref={punchEl} title={punchTitle} hidden={!showPunch} data-unavailable={available.punch === false ? '' : undefined}><span>{punchLabel}</span></div>
        <div class={`${s.btn} ${s.detonate}`} ref={detonateEl} title={detonateTitle} hidden={!showDetonate} data-unavailable={available.detonate === false ? '' : undefined}><span>{detonateLabel}</span></div>
        <div class={`${s.btn} ${s.teleport}`} ref={teleportEl} title={teleportTitle} hidden={!showTeleport} data-unavailable={available.teleport === false ? '' : undefined}><span>{teleportLabel}</span></div>
        <div class={`${s.btn} ${s.bomb}`} ref={bombEl} title={bombTitle} data-unavailable={available.bomb === false ? '' : undefined}><span>{bombLabel}</span></div>
      </div>
    </div>
  );
}
