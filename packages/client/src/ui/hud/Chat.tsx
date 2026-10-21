// Minecraft-style chat over the game, bottom-left.
// Closed: the newest lines show up on dark strips and fade out after a few seconds (on touch
// fewer, shorter-lived and clamped to two rows, so a busy chat doesn't cover the arena).
// Open (Enter / T, or the chat button): the whole history scrolls above an input line;
// Enter sends (an empty line closes), Esc closes, ↑ / ↓ walk through what you sent before.
// Messages with `from === ''` or a name starting with '@' (e.g. @server) are system messages.
import { useEffect, useRef, useState } from 'preact/hooks';
import { isTouchDevice, lastDevice } from '$/input/device';
import { t } from '../i18n';
import { Avatar } from '../Avatar';
import { Icon } from '../icons';
import { actions, chat, chatOpen, hud, scoreboardOpen } from '../store';

const SHOW_MS = 10_000;   // a closed chat keeps a line this long (fades out over the end)
const CLOSED_LINES = 10;
const TOUCH_SHOW_MS = 6_000;
const TOUCH_CLOSED_LINES = 3;
const MAX_LEN = 100;

const isSystem = (m: { from: string; name: string }) => !m.from || m.name.startsWith('@');

/** What you sent this session, newest last (↑ / ↓ in the input). */
const sent: string[] = [];

function Line({ m, meId }: { m: (typeof chat.value)[number]; meId: string }) {
  const sys = isSystem(m);
  return (
    <div class={`mc-chat__line ${sys ? 'is-sys' : ''} ${!sys && m.from === meId ? 'is-me' : ''}`}>
      {sys ? <span class="mc-chat__text">{m.text}</span> : <><Avatar id={m.from} size={14} /><b>&lt;{m.name}&gt;</b> <span class="mc-chat__text">{m.text}</span></>}
    </div>
  );
}

export function Chat() {
  const open = chatOpen.value;
  const msgs = chat.value;
  const meId = hud.value?.me?.id ?? '';
  const [now, setNow] = useState(() => Date.now());
  const [text, setText] = useState('');
  const histPos = useRef(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const touch = lastDevice.value === 'touch';
  const showMs = touch ? TOUCH_SHOW_MS : SHOW_MS;
  // a closed chat lets lines expire (and steps aside for the scoreboard); tick only while there is something to expire
  const recent = open || scoreboardOpen.value ? [] : msgs.slice(-(touch ? TOUCH_CLOSED_LINES : CLOSED_LINES)).filter((m) => now - m.at < showMs);
  useEffect(() => {
    if (open || !recent.length) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [open, recent.length]);
  useEffect(() => setNow(Date.now()), [msgs.length]);

  useEffect(() => {
    if (!open) { inputRef.current?.blur(); setText(''); histPos.current = -1; return; }
    inputRef.current?.focus({ preventScroll: true });
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (open && el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const close = () => { chatOpen.value = false; };

  const submit = (e: Event) => {
    e.preventDefault();
    const v = text.trim().slice(0, MAX_LEN);
    if (v) {
      actions.sendChat(v);
      actions.uiSound('chat');
      if (sent[sent.length - 1] !== v) sent.push(v);
      if (sent.length > 50) sent.shift();
    }
    close();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && sent.length) {
      e.preventDefault();
      const pos = histPos.current < 0 ? sent.length : histPos.current;
      const next = e.key === 'ArrowUp' ? Math.max(0, pos - 1) : pos + 1;
      if (next >= sent.length) { histPos.current = -1; setText(''); return; }
      histPos.current = next;
      setText(sent[next]!);
    }
  };

  return (
    <div class={`mc-chat ${open ? 'is-open' : ''}`} aria-label={t('hud.chat')}>
      {open ? (
        <div class="mc-chat__list" ref={listRef} data-scrollable aria-live="polite">
          {msgs.length ? msgs.map((m) => <Line key={m.id} m={m} meId={meId} />) : <div class="mc-chat__line is-sys">{t('chat.empty')}</div>}
        </div>
      ) : (
        <div class="mc-chat__list" aria-hidden="true">
          {recent.map((m) => (
            <div key={m.id} style={{ opacity: Math.min(1, (showMs - (now - m.at)) / 1500) }}><Line m={m} meId={meId} /></div>
          ))}
        </div>
      )}
      {open && (
        <form class="mc-chat__form" onSubmit={submit}>
          <input
            ref={inputRef}
            class="mc-chat__input"
            value={text}
            maxLength={MAX_LEN}
            enterKeyHint="send"
            autoComplete="off"
            spellcheck={false}
            aria-label={t('chat.placeholder')}
            placeholder={isTouchDevice ? t('chat.placeholder') : t('hud.chatPlaceholder')}
            onInput={(e) => { histPos.current = -1; setText((e.target as HTMLInputElement).value); }}
            onKeyDown={onKey}
          />
          <button class="icon-btn mc-chat__send" type="submit" aria-label={t('chat.sendShort')} title={t('chat.sendShort')}><Icon name="chat" /></button>
        </form>
      )}
    </div>
  );
}
