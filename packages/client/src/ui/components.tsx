// Shared UI primitives: Modal, Button, Slider, Toggle, Segmented.
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import { t } from './i18n';
import { actions } from './store';
import { focusables } from './nav';

// ---------------------------------------------------------------- Modal
export interface ModalProps {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  size?: 'sm' | 'md' | 'lg';
  /** Accent for the header stripe. */
  accent?: 'orange' | 'pink' | 'cyan' | 'lime';
}

export function Modal({ title, onClose, children, footer, size = 'md', accent = 'orange' }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const body = el.querySelector<HTMLElement>('.modal__body');
    const first = el.querySelector<HTMLElement>('[data-autofocus]') ?? (body && focusables(body)[0]) ?? focusables(el)[0];
    // Don't pop the on-screen keyboard on phones just because a dialog opened.
    if (first && !(matchMedia('(pointer: coarse)').matches && first.tagName === 'INPUT')) first.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); actions.uiSound('back'); onClose(); }
      if (e.key === 'Tab') {
        // focus trap
        const items = focusables(el);
        if (!items.length) return;
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
        items[next].focus();
        e.preventDefault();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('keydown', onKey);
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div class="modal-backdrop" data-modal-open onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} class={`modal modal--${size} accent-${accent}`} role="dialog" aria-modal="true" aria-labelledby={titleId} data-nav-root>
        <header class="modal__head">
          <h2 id={titleId} class="pixel">{title}</h2>
          <button class="icon-btn" onClick={() => { actions.uiSound('back'); onClose(); }} aria-label={t('common.close')} title={t('common.close')}>✕</button>
        </header>
        <div class="modal__body" data-scrollable>{children}</div>
        {footer && <footer class="modal__foot">{footer}</footer>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Button
type BtnVariant = 'primary' | 'pink' | 'cyan' | 'lime' | 'ghost' | 'danger' | 'plain';
export interface ButtonProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'icon' | 'size' | 'type'> {
  variant?: BtnVariant;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: ComponentChildren;
  sub?: ComponentChildren;
  block?: boolean;
  type?: 'button' | 'submit';
}

export function Button({ variant = 'plain', size = 'md', icon, sub, block, children, onClick, class: cls, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      class={`btn btn--${variant} btn--${size} ${block ? 'btn--block' : ''} ${cls ?? ''}`}
      onClick={(e) => { actions.uiSound('click'); onClick?.(e); }}
    >
      {icon && <span class="btn__icon" aria-hidden="true">{icon}</span>}
      <span class="btn__text">
        <span class="btn__label">{children}</span>
        {sub && <span class="btn__sub">{sub}</span>}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- Slider
export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onInput: (v: number) => void;
  format?: (v: number) => string;
}

export function Slider({ label, value, min, max, step, onInput, format }: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div class="field field--slider">
      <label for={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--pct': `${pct}%` }}
        onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))}
      />
      <output for={id}>{format ? format(value) : value}</output>
    </div>
  );
}

// ---------------------------------------------------------------- Toggle
export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      class="field field--toggle"
      onClick={() => { actions.uiSound('click'); onChange(!checked); }}
    >
      <span class="field__text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <span class="switch" aria-hidden="true"><span /></span>
    </button>
  );
}

// ---------------------------------------------------------------- Segmented
export function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: ComponentChildren }[];
  onChange: (v: T) => void;
}) {
  return (
    <div class="field field--seg">
      <span class="field__label">{label}</span>
      <div class="seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            type="button"
            role="radio"
            aria-checked={o.value === value}
            class={o.value === value ? 'is-on' : ''}
            onClick={() => { actions.uiSound('click'); onChange(o.value); }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: ComponentChildren }) {
  return <kbd class="kbd">{children}</kbd>;
}
