// The menu: a drawer over the live world (menu button in the bottom pill, Esc, gamepad Start).
// Tabs: «Игра» (profile, how to play, fullscreen, room code, back to the main menu, links), «Игроки»
// (player list, spectators) and «Настройки» (volume + device settings).
import { useEffect, useRef, useState } from 'preact/hooks';
import { canFullscreen, isFullscreen, toggleFullscreen } from '$/input/fullscreen';
import { Button, Logo } from './components';
import { copyRoom, shareRoom } from './hud/RoomCode';
import { t } from './i18n';
import { Icon } from './icons';
import { LINKS } from './links';
import { NAME_MAX, randomName } from './names';
import { SettingsSections } from './SettingsModal';
import { HeroSprite } from './sprites';
import { actions, hud, menuOpen, openModal, players, room, setName, settings, spectators } from './store';

type Tab = 'game' | 'players' | 'settings';
let lastTab: Tab = 'game';

function Profile() {
  const { name, skin, language } = settings.value;
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
          <span class="nametag nametag--lg">{name}</span>
        )}
        <div class="profile__btns">
          {!editing && <Button size="sm" onClick={() => { setDraft(name); setEditing(true); }}>{t('menu.edit')}</Button>}
          <Button size="sm" onClick={() => openModal('skin')}>{t('menu.avatar')}</Button>
          <Button size="sm" onClick={() => setName(randomName(language))} title={t('menu.randomName')} aria-label={t('menu.randomName')}><Icon name="dice" /></Button>
        </div>
      </div>
    </section>
  );
}

function GameTab() {
  const r = room.value;
  return (
    <>
      <Profile />
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
          </div>
        </section>
      )}

      <Button block variant="white" icon={<Icon name="home" />} onClick={() => { menuOpen.value = false; actions.leave(); }}>{t('menu.toMainMenu')}</Button>

      <section class="card">
        <h3>{t('menu.links')}:</h3>
        <ul class="links">
          {LINKS.map((l) => (
            <li><a href={l.href} target="_blank" rel="noopener"><Icon name={l.icon} class="links__icon" />{t(l.key)}</a></li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function PlayerList() {
  const list = players.value;
  const spect = spectators.value.length + list.filter((p) => !p.inRound).length;
  return (
    <>
      <section class="card">
        <h3>{t('menu.playerList')}</h3>
        {list.length ? (
          <ul class="plist">
            {list.map((p) => (
              <li key={p.id} class={`${p.isLocal ? 'is-me' : ''}`} data-state={!p.inRound ? 'wait' : p.alive || p.respawning ? 'alive' : 'dead'}>
                <HeroSprite skin={p.skin} scale={0.9} still={!p.alive} />
                <span class="plist__name">{p.name}{p.isBot && <small> · {t('hud.bot')}</small>}</span>
                <span class="plist__stats"><span><Icon name="crown" /> {p.wins}</span><span><Icon name="gun" /> {p.kills}</span><span><Icon name="skull" /> {p.deaths}</span></span>
              </li>
            ))}
          </ul>
        ) : <p class="muted">—</p>}
      </section>
      <p class="spectators">{t('menu.spectators', { n: spect })}</p>
    </>
  );
}

export function MenuDrawer() {
  const [tab, setTab] = useState<Tab>(lastTab);
  const open = menuOpen.value;
  const ref = useRef<HTMLElement>(null);
  const pick = (t2: Tab) => { lastTab = t2; actions.uiSound('click'); setTab(t2); };

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    // Keyboard / gamepad users land on the active tab; pointer users keep focus where it was.
    if (document.documentElement.hasAttribute('data-kbd'))
      ref.current?.querySelector<HTMLElement>('.tabs button[aria-selected="true"]')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-modal-open]')) { e.preventDefault(); menuOpen.value = false; }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (prev && document.contains(prev)) prev.focus({ preventScroll: true }); };
  }, [open]);

  const h = hud.value;
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
        <div class="tabs" role="tablist">
          {(['game', 'players', 'settings'] as Tab[]).map((id) => (
            <button role="tab" aria-selected={tab === id} class={tab === id ? 'is-on' : ''} onClick={() => pick(id)}>
              {id === 'game' ? <><Icon name="gamepad" /> {t('menu.tabGame')}</> : id === 'players' ? <><Icon name="users" /> {t('menu.tabPlayers')} {h ? h.players.length : 0}</> : <><Icon name="gear" /> {t('settings.title')}</>}
            </button>
          ))}
        </div>
        <div class="drawer__body" data-scrollable>
          {tab === 'game' && <GameTab />}
          {tab === 'players' && <PlayerList />}
          {tab === 'settings' && <SettingsSections />}
        </div>
      </aside>
    </>
  );
}
