import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { actions, chat, chatOpen } from '../store';

const VISIBLE_IDLE = 6;

export function Chat({ compact }: { compact: boolean }) {
  const open = chatOpen.value;
  const msgs = chat.value;
  const shown = open ? msgs : msgs.slice(-VISIBLE_IDLE);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
    else inputRef.current?.blur();
  }, [open]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, open]);

  const send = (e: Event) => {
    e.preventDefault();
    const v = text.trim();
    if (v) { actions.sendChat(v.slice(0, 120)); actions.uiSound('chat'); }
    setText('');
    chatOpen.value = false;
  };

  return (
    <div class={`chat ${open ? 'is-open' : ''}`}>
      <div class="chat__log" ref={logRef} data-scrollable aria-live="polite">
        {shown.map((m) => (
          <div key={m.id} class={`chat__msg ${m.from ? '' : 'chat__msg--sys'}`}>
            {m.from && <b>{m.name}:</b>} <span>{m.text}</span>
          </div>
        ))}
      </div>
      {open && (
        <form class="chat__form" onSubmit={send}>
          <input
            ref={inputRef}
            class="input chat__input"
            value={text}
            maxLength={120}
            enterKeyHint="send"
            autoComplete="off"
            placeholder={compact ? t('hud.chatPlaceholderShort') : t('hud.chatPlaceholder')}
            onInput={(e) => setText((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setText(''); chatOpen.value = false; }
            }}
            onBlur={() => { if (compact) return; if (!text.trim()) chatOpen.value = false; }}
          />
          <button class="btn btn--cyan btn--sm" type="submit" onMouseDown={(e) => e.preventDefault()}>{t('hud.send')}</button>
        </form>
      )}
    </div>
  );
}
