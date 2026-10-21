// The menu: a drawer over the live world (menu button in the bottom pill, Esc, gamepad Start):
// profile, settings (the main menu's modal), players (the scoreboard Tab holds, for touch and
// gamepad too), how to play, fullscreen, room code, «Отключиться» (on touch the only one: the
// bottom pill shows just «Подключиться»), back to the main menu, links.
import { useEffect, useRef, useState } from 'preact/hooks';
import { canFullscreen, isFullscreen, toggleFullscreen } from '$/input/fullscreen';
import { discord, discordInvite } from '$/discord';
import { Avatar } from './Avatar';
import { BOT_DIFFICULTIES, MAX_PLAYERS } from '@ob/game';
import { Button, Logo, Segmented, Toggle } from './components';
import { copyRoom, shareRoom } from './hud/RoomCode';
import { t } from './i18n';
import { Icon } from './icons';
import { LINKS, showLinks } from './links';
import { NAME_MAX, randomName } from './names';
import { HeroSprite } from './sprites';
import { actions, hud, identity, menuOpen, openModal, players, room, roomSettings, scoreboardOpen, setName, settings } from './store';

function Profile() {
  const { skin, language } = settings.value;
  const id = identity.value;
  const name = id.name;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) input.current?.select(); }, [editing]);
  const save = (e?: Event) => {
    e?.preventDefault();
    setName(draft.trim() || randomName(language));
    setEditing(false);
  };
  return (
    <section class="card profile">
      <button class="profile__avatar" onClick={() => { actions.uiSound('click'); openModal('skin'); }} title={t('menu.chooseSkin')} aria-label={t('menu.chooseSkin')}>
        <span class="profile__spot" aria-hidden="true" />
        <HeroSprite skin={skin} anim="RunDown" scale={2} />
      </button>
      <div class="profile__main">
        {editing ? (
          <form class="profile__edit" onSubmit={save}>
            <input
              ref={input}
              class="input"
              value={draft}
              maxLength={NAME_MAX}
              aria-label={t('menu.nickname')}
              autoComplete="nickname"
              spellcheck={false}
              enterKeyHint="done"
              onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); } }}
            />
            <Button type="submit" size="sm">OK</Button>
          </form>
        ) : (
          <span class="nametag nametag--lg">{id.avatar && <Avatar url={id.avatar} size={22} />}{name}</span>
        )}
        {id.locked && <small class="muted"><Icon name="discord" size={12} /> {t('discord.nameHint')}</small>}
        <div class="profile__btns">
          {!editing && !id.locked && <Button size="sm" onClick={() => { setDraft(name); setEditing(true); }}>{t('menu.edit')}</Button>}
          <Button size="sm" onClick={() => openModal('skin')}>{t('menu.avatar')}</Button>
          {!id.locked && <Button size="sm" onClick={() => setName(randomName(language))} title={t('menu.randomName')} aria-label={t('menu.randomName')}><Icon name="dice" /></Button>}
        </div>
      </div>
    </section>
  );
}

function MenuBody() {
  const r = room.value;
  return (
    <>
      <Profile />
      <div class="row2">
        <Button block icon={<Icon name="gear" />} onClick={() => openModal('settings')}>{t('settings.title')}</Button>
        <Button block icon={<Icon name="users" />} onClick={() => { menuOpen.value = false; scoreboardOpen.value = true; }}>{t('menu.players')} {players.value.length}</Button>
      </div>
      <div class="row2">
        <Button block icon={<Icon name="question" />} onClick={() => openModal('howto')}>{t('menu.howTo2')}</Button>
        {canFullscreen && <Button block  icon={<Icon name="fullscreen" />} onClick={() => toggleFullscreen()} aria-pressed={isFullscreen.value}>{t('menu.fullscreen')}</Button>}
      </div>

      {r && r.isPrivate && !r.offline && (
        <section class="card">
          <h3><Icon name="lock" /> {t('menu.privateRoom')}</h3>
          <div class="room-line">
            <span class="room-line__code">{r.code}</span>
            <Button size="sm" icon={<Icon name="link" />} onClick={() => copyRoom(r.code)}>{t('hud.copyLink')}</Button>
            {typeof navigator.share === 'function' && <Button size="sm" icon={<Icon name="share" />} onClick={() => shareRoom(r.code)}>{t('hud.share')}</Button>}
            {discord.value && <Button size="sm" icon={<Icon name="discord" />} onClick={() => { actions.uiSound('click'); discordInvite(); }}>{t('discord.invite')}</Button>}
          </div>
        </section>
      )}

      {r && r.isPrivate && !r.offline && <RoomSettingsCard />}

      {hud.value?.connected && <Button block onClick={() => { menuOpen.value = false; actions.uiSound('back'); actions.play(false); }}>{t('hud.disconnect')}</Button>}

      {!discord.value && <Button block variant="white" icon={<Icon name="home" />} onClick={() => { menuOpen.value = false; actions.leave(); }}>{t('menu.toMainMenu')}</Button>}

      {showLinks && <section class="card">
        <h3>{t('menu.links')}:</h3>
        <ul class="links">
          {LINKS.map((l) => (
            <li><a href={l.href} target="_blank" rel="noopener"><Icon name={l.icon} class="links__icon" />{t(l.key)}</a></li>
          ))}
        </ul>
      </section>}
    </>
  );
}

/** − value + row for small counts. */
function Stepper({ label, value, min, max, disabled, onChange }: {
  label: string; value: number; min: number; max: number; disabled: boolean; onChange: (v: number) => void;
}) {
  const set = (v: number) => { if (!disabled) onChange(Math.min(max, Math.max(min, v))); };
  return (
    <div class="field rstep">
      <span class="field__label">{label}</span>
      <div class="rstep__ctl">
        <button type="button" class="icon-btn" disabled={disabled || value <= min} onClick={() => { actions.uiSound('click'); set(value - 1); }} aria-label="−"><Icon name="minus" size={10} /></button>
        <span class="rstep__value">{value}</span>
        <button type="button" class="icon-btn" disabled={disabled || value >= max} onClick={() => { actions.uiSound('click'); set(value + 1); }} aria-label="+"><Icon name="plus" size={10} /></button>
      </div>
    </div>
  );
}

/** Own online room: bots, their difficulty, capacity and the zone. Only the host can edit. */
function RoomSettingsCard() {
  const rs = roomSettings.value;
  if (!rs) return null;
  const off = !rs.isHost;
  const set = actions.setRoomSettings;
  return (
    <section class={`card room-settings ${off ? 'is-readonly' : ''}`}>
      <h3><Icon name="gear" /> {t('room.settings')}</h3>
      <Stepper label={t('room.bots')} value={rs.bots} min={0} max={Math.max(0, rs.maxPlayers - 1)} disabled={off} onChange={(bots) => set({ bots })} />
      <Segmented
        label={t('bots.difficulty')}
        value={rs.botDifficulty}
        options={BOT_DIFFICULTIES.map((d) => ({ value: d, label: t(`bots.${d}`) }))}
        onChange={(botDifficulty) => { if (!off) set({ botDifficulty }); }}
      />
      <Stepper label={t('room.maxPlayers')} value={rs.maxPlayers} min={2} max={MAX_PLAYERS} disabled={off} onChange={(maxPlayers) => set({ maxPlayers })} />
      <Toggle label={t('room.zone')} hint={t('room.zoneHint')} checked={rs.zone} onChange={(zone) => { if (!off) set({ zone }); }} />
      <Toggle label={t('room.events')} hint={t('room.eventsHint')} checked={rs.events} onChange={(events) => { if (!off) set({ events }); }} />
      {off && <p class="muted">{t('room.hostOnly')}</p>}
    </section>
  );
}

export function MenuDrawer() {
  const open = menuOpen.value;
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    // Keyboard / gamepad users land on the first control; pointer users keep focus where it was.
    if (document.documentElement.hasAttribute('data-kbd'))
      ref.current?.querySelector<HTMLElement>('.drawer__body button')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-modal-open]')) { e.preventDefault(); menuOpen.value = false; }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (prev && document.contains(prev)) prev.focus({ preventScroll: true }); };
  }, [open]);

  return (
    <>
      {open && <div class="drawer-scrim" onPointerDown={() => { menuOpen.value = false; }} />}
      <aside
        ref={ref}
        class={`drawer drawer--left ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
        inert={!open ? true : undefined}
        data-nav-root={open ? '' : undefined}
        aria-label={t('hud.menu')}
      >
        <header class="drawer__head">
          <Logo class="drawer__logo" />
          <button class="icon-btn" onClick={() => { actions.uiSound('back'); menuOpen.value = false; }} aria-label={t('common.close')} title={t('common.close')}><Icon name="close" /></button>
        </header>
        <div class="drawer__body" data-scrollable>
          <MenuBody />
        </div>
      </aside>
    </>
  );
}
