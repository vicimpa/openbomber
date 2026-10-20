import { t } from '../i18n';
import { actions, roomLink, toast } from '../store';

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for insecure contexts (LAN dev over http).
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function shareRoom(code: string) {
  const url = roomLink(code);
  if (navigator.share) {
    navigator.share({ title: 'OpenBomber', text: t('hud.shareText', { code }), url }).catch(() => {});
    return;
  }
  copyRoom(code);
}

export async function copyRoom(code: string) {
  if (await copy(roomLink(code))) { actions.uiSound('click'); toast(`🔗 ${t('hud.copied')}`, 'good'); }
}

/** Private room code with copy / share buttons. `compact` = just the code chip (HUD on phones). */
export function RoomCode({ code, compact }: { code: string; compact?: boolean }) {
  const canShare = typeof navigator.share === 'function';
  return (
    <div class={`room-code ${compact ? 'room-code--compact' : ''}`}>
      <span class="room-code__label">{t('hud.room')}</span>
      <span class="room-code__code pixel">{code}</span>
      <button class="icon-btn icon-btn--sm" onMouseDown={(e) => e.preventDefault()} onClick={() => copyRoom(code)} title={t('hud.copyLink')} aria-label={t('hud.copyLink')}>🔗</button>
      {canShare && (
        <button class="icon-btn icon-btn--sm" onMouseDown={(e) => e.preventDefault()} onClick={() => shareRoom(code)} title={t('hud.share')} aria-label={t('hud.share')}>📤</button>
      )}
    </div>
  );
}
