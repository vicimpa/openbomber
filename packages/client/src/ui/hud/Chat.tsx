// Canon chat: a right-side drawer («Чат:», «Скрыть», «Сообщения» + «Send (Enter)») and a
// ticker of recent messages that fade over the game while the drawer is closed.
// Messages with `from === ''` or a name starting with '@' (e.g. @server) are system messages.
import { useEffect, useRef, useState } from 'preact/hooks';
import { isTouchDevice } from '$/input/device';
import { t } from '../i18n';
import { actions, chat, chatOpen } from '../store';

const isSystem = (m: { from: string; name: string }) => !m.from || m.name.startsWith('@');
const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function ChatTicker() {
  if (chatOpen.value) return null;
  const msgs = chat.value.slice(-5);
  return (
    <div class="ticker" aria-hidden="true">
      {msgs.map((m) => (
        <div key={m.id} class={`ticker__msg ${isSystem(m) ? 'is-sys' : ''}`}>
          <b>{isSystem(m) ? (m.name || t('hud.server')) : m.name}:</b> {m.text}
        </div>
      ))}
    </div>
  );
}

export function ChatDrawer() {
  const open = chatOpen.value;
  const msgs = chat.value;
  const [text, setText] = useState('');
  const [blur, setBlur] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // On phones don't pop the keyboard just because the drawer opened.
    if (open && !isTouchDevice) inputRef.current?.focus({ preventScroll: true });
    if (!open) inputRef.current?.blur();
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[data-modal-open]')) { e.preventDefault(); chatOpen.value = false; } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = (e: Event) => {
    e.preventDefault();
    const v = text.trim();
    if (v) { actions.sendChat(v.slice(0, 120)); actions.uiSound('chat'); }
    setText('');
    if (!isTouchDevice && !v) chatOpen.value = false;
  };

  return (
    <>
      {open && <div class="drawer-scrim drawer-scrim--light" onPointerDown={() => { chatOpen.value = false; }} />}
      <aside class={`drawer drawer--right chat ${open ? 'is-open' : ''}`} aria-hidden={!open} inert={!open ? true : undefined} aria-label={t('hud.chat')}>
        <header class="chat__head">
          <span>{t('chat.title')}</span>
          <span class="chat__head-btns">
            <button class="btn btn--flat btn--sm" onClick={() => setBlur(!blur)}>{blur ? t('chat.show') : t('chat.hide')}</button>
            <button class="icon-btn icon-btn--sm" onClick={() => { chatOpen.value = false; }} aria-label={t('common.close')}>✕</button>
          </span>
        </header>
        <div class={`chat__list ${blur ? 'is-blur' : ''}`} ref={listRef} data-scrollable aria-live="polite">
          {!msgs.length && <p class="muted chat__empty">{t('chat.empty')}</p>}
          {msgs.map((m) => (
            <div key={m.id} class={`chat__item ${isSystem(m) ? 'is-sys' : ''}`} data-isme={m.from === 'me' ? '' : undefined}>
              <div class="chat__meta"><b>{isSystem(m) ? (m.name || t('hud.server')) : m.name}</b><small>{time(m.at)}</small></div>
              <div class="chat__text">{m.text}</div>
            </div>
          ))}
        </div>
        <form class="chat__form" onSubmit={send}>
          <input
            ref={inputRef}
            class="input chat__input"
            value={text}
            maxLength={120}
            enterKeyHint="send"
            autoComplete="off"
            placeholder={t('chat.placeholder')}
            aria-label={t('chat.placeholder')}
            onInput={(e) => setText((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setText(''); chatOpen.value = false; } }}
          />
          <button class="btn btn--flat btn--sm" type="submit">{isTouchDevice ? t('chat.sendShort') : t('chat.send')}</button>
        </form>
      </aside>
    </>
  );
}
