// In-world HUD widgets (canon OpenBomber language: flat translucent pills, BetterVCR, pixel-icon
// counters, red name tags). All read signals from ../store; none of them owns game state.
import { Phase, PickupType } from '@ob/game';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { HudEffect, HudMe, HudPlayer, HudSnapshot } from '../hud';
import { t, tr } from '../i18n';
import { ABILITY_PICKUP, CURSE_BY_ID, PICKUP_BY_TYPE } from '../pickups';
import { Icon, type IconName } from '../icons';
import { Avatar } from '../Avatar';
import { HeroSprite, PickupIcon } from '../sprites';
import { actions, chat, chatOpen, fps, killFeed, menuOpen, room, settings } from '../store';
import { RoomCode } from './RoomCode';

// ---------------------------------------------------------------- debug (top-left, 8px)
export function DebugInfo({ ping }: { ping: number }) {
  const s = settings.value;
  if (!s.showFps && !s.showPing) return null;
  const offline = room.value?.offline;
  return (
    <div class="debug" aria-hidden="true">
      {s.showPing && <span>{offline ? 'Offline' : `Ping ${Math.round(ping)}ms`}</span>}
      {s.showFps && <span>FPS {fps.value}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- top pill
function RoomTag() {
  const r = room.value;
  if (!r) return null;
  if (r.offline) return <span class="pill__tag" title={t('menu.vsBots')}><Icon name="bot" /></span>;
  if (r.isPrivate) return <span class="pill__tag" title={t('hud.room')}><Icon name="lock" /> {r.code}</span>;
  return null;
}

export function TopPill({ h }: { h: HudSnapshot | null }) {
  const me = h?.me;
  const playing = !!me && !me.spectating;
  return (
    <div class="pill pill--top" role="status">
      {playing && me ? (
        <span class="counters">
          <span title={t('hud.alive')}><Icon name="users" /> {h!.alive} / {h!.total}</span>
          <span title={t('hud.wins')}><Icon name="crown" /><i class="counters__x"> ×</i> {me.wins}</span>
          <span title={t('hud.kills')}><Icon name="gun" /><i class="counters__x"> ×</i> {me.kills}</span>
          <span title={t('hud.deaths')}><Icon name="skull" /><i class="counters__x"> ×</i> {me.deaths}</span>
        </span>
      ) : (
        <span>{t('hud.spectating')}</span>
      )}
      <RoomTag />
    </div>
  );
}

// ---------------------------------------------------------------- bottom pill (core loop)
export function BottomPill({ h }: { h: HudSnapshot | null }) {
  const connected = !!h?.connected;
  const unread = useUnread();
  return (
    <div class="pill pill--bottom bottom-pill">
      <button
        class="pill-btn"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { actions.uiSound('click'); menuOpen.value = true; }}
        aria-label={t('hud.menu')}
        title={t('hud.menu')}
      >
        <Icon name="menu" />
      </button>
      <button
        class={`btn btn--white btn--lg bottom-pill__main ${connected ? 'is-connected' : ''}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { actions.uiSound(connected ? 'back' : 'join'); actions.play(!connected); }}
      >
        {connected ? t('hud.disconnect') : t('hud.connect')}
      </button>
      <button
        class="pill-btn"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { actions.uiSound('click'); chatOpen.value = !chatOpen.value; }}
        aria-label={t('hud.chat')}
        title={`${t('hud.chat')} (T)`}
        aria-pressed={chatOpen.value}
      >
        <Icon name="chat" />
        {unread > 0 && <i class="badge">{unread > 9 ? '9+' : unread}</i>}
      </button>
    </div>
  );
}

/** Messages that arrived while the chat drawer was closed. */
function useUnread() {
  const seen = useRef(chat.value.length ? chat.value[chat.value.length - 1].id : 0);
  const list = chat.value;
  if (chatOpen.value && list.length) seen.current = list[list.length - 1].id;
  return list.filter((m) => m.id > seen.current).length;
}

// ---------------------------------------------------------------- local stats strip
const EFFECT_ICON: Record<string, PickupType | IconName> = {
  shield: PickupType.Shield, ghost: PickupType.Ghost, crazy: PickupType.Crazy, fire: PickupType.Fire,
  speed: PickupType.SpeedUp, kick: PickupType.Kick, glove: PickupType.Glove, punch: PickupType.Punch,
  remote: PickupType.Remote, pierce: PickupType.Pierce, lineBomb: PickupType.LineBomb, bombPass: PickupType.BombPass,
  curse: PickupType.Skull, invulnerable: 'sparkle', stun: 'star', slow: 'snail',
};

function effectName(e: HudEffect): string {
  if (e.kind === 'curse' && e.curse) { const c = CURSE_BY_ID.get(e.curse); if (c) return tr(c.name); }
  const icon = EFFECT_ICON[e.kind];
  if (typeof icon === 'number') { const info = PICKUP_BY_TYPE.get(icon); if (info) return tr(info.name); }
  const key = `effect.${e.kind}` as 'effect.shield';
  const s = t(key);
  return s === key ? e.kind : s;
}

function EffectPill({ e, compact }: { e: HudEffect; compact?: boolean }) {
  const icon = EFFECT_ICON[e.kind] ?? 'hourglass';
  const name = effectName(e);
  const curse = e.kind === 'curse';
  return (
    <div class={`fx ${curse ? 'fx--curse' : ''} ${e.left < 3 ? 'is-ending' : ''}`} title={name} style={{ '--frac': e.frac }}>
      {typeof icon === 'number' ? <PickupIcon type={icon} size={compact ? 16 : 20} /> : <Icon name={icon} size={compact ? 10 : 20} />}
      {curse && <span class="fx__name">{name}</span>}
      <span class="fx__time">{Math.ceil(e.left)}</span>
      <i class="fx__bar" aria-hidden="true" />
    </div>
  );
}

function Stat({ type, children, label, compact }: { type: PickupType; children: ComponentChildren; label: string; compact?: boolean }) {
  return (
    <div class="stat" title={label}>
      <PickupIcon type={type} size={compact ? 16 : 20} />
      <b class="stat__val">{children}</b>
    </div>
  );
}

export function StatsStrip({ me, compact }: { me: HudMe; compact?: boolean }) {
  const free = Math.max(0, me.bombs - me.bombsPlaced);
  const hearts = me.lives;
  return (
    <div class="strip" aria-label={t('hud.bombs')}>
      <Stat compact={compact} type={PickupType.BombUp} label={t('hud.bombs')}><span key={me.bombs} class="pop">{free}<small>/{me.bombs}</small></span></Stat>
      <Stat compact={compact} type={PickupType.FireUp} label={t('hud.radius')}><span key={me.radius} class="pop">{me.radius}</span></Stat>
      {hearts > 0 && (
        <div class="stat" title={t('hud.lives')}>
          {Array.from({ length: Math.min(hearts, 3) }, () => <Icon name="heart" size={compact ? 10 : 20} />)}{hearts > 3 && <b class="stat__val">×{hearts}</b>}
        </div>
      )}
      {me.teleports > 0 && (
        <Stat compact={compact} type={PickupType.Teleport} label={t('hud.teleports')}><span key={me.teleports} class="pop">{me.teleports}</span></Stat>
      )}
      {me.abilities.map((a) => {
        const p = ABILITY_PICKUP.get(a)!;
        const info = PICKUP_BY_TYPE.get(p);
        return <div class="stat" key={a}><PickupIcon type={p} size={compact ? 16 : 20} title={info ? tr(info.name) : ''} /></div>;
      })}
      {me.effects.map((e) => <EffectPill key={e.kind} e={e} compact={compact} />)}
    </div>
  );
}

// ---------------------------------------------------------------- kill feed
export function KillFeed() {
  return (
    <ol class="killfeed" aria-live="polite">
      {killFeed.value.map((k) => (
        <li key={k.id} class={`kill ${k.victim.isLocal || k.killer?.isLocal ? 'kill--me' : ''}`}>
          {k.kind === 'kill' && k.killer && <>
            <HeroSprite skin={k.killer.skin} scale={0.6} still />
            <span class="kill__name">{k.killer.name}</span>
            <Icon name="gun" class="kill__icon" />
          </>}
          {k.kind === 'self' && <Icon name="bomb" class="kill__icon" />}
          {k.kind === 'world' && <Icon name="brick" class="kill__icon" />}
          <HeroSprite skin={k.victim.skin} scale={0.6} still />
          <span class="kill__name kill__name--victim">{k.victim.name}</span>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- banners & overlays
export function Banners({ h }: { h: HudSnapshot }) {
  const [sd, setSd] = useState(false);
  useEffect(() => {
    if (!h.suddenDeath) { setSd(false); return; }
    setSd(true);
    const id = setTimeout(() => setSd(false), 3200);
    return () => clearTimeout(id);
  }, [h.suddenDeath]);
  return (
    <div class="banners">
      {h.shrinkIn > 0 && <div class="banner banner--warn" role="alert"><Icon name="warning" /> {t('hud.shrink', { n: Math.ceil(h.shrinkIn) })}</div>}
      {sd && <div class="banner banner--sd" role="alert"><Icon name="warning" /> {t('hud.suddenDeath')} <small>{t('hud.suddenDeathSub')}</small></div>}
      {h.me && h.me.respawnIn > 0 && <div class="banner"><Icon name="hourglass" /> {t('hud.respawn', { n: h.me.respawnIn.toFixed(1) })}</div>}
    </div>
  );
}

export function Countdown({ h }: { h: HudSnapshot }) {
  const prev = useRef(h.phase);
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (prev.current === Phase.Countdown && h.phase === Phase.Playing) {
      setGo(true);
      const id = setTimeout(() => setGo(false), 900);
      prev.current = h.phase;
      return () => clearTimeout(id);
    }
    prev.current = h.phase;
  }, [h.phase]);
  if (h.phase === Phase.Countdown && h.countdown > 0)
    return <div class="center-big" aria-live="assertive"><span key={h.countdown} class="countdown">{h.countdown}</span></div>;
  if (go) return <div class="center-big"><span class="countdown countdown--go">{t('hud.go')}</span></div>;
  return null;
}

/** Canon round result: «<ник> победил» / «Никто не выиграл». */
export function RoundResult({ h }: { h: HudSnapshot }) {
  if (h.phase !== Phase.RoundOver) return null;
  const w = h.winner;
  return (
    <div class="round-result box" role="status" aria-live="assertive">
      {w ? <>
        <span class="round-result__hero"><span class="spot" /><HeroSprite skin={w.skin} anim="RunDown" scale={2} /></span>
        <span class="round-result__text">
          <b>{w.isLocal && <Icon name="trophy" />} {w.isLocal ? t('hud.youWon') : t('hud.winnerToast', { name: w.name })}</b>
          <small><Icon name="crown" /> × {w.wins}</small>
        </span>
      </> : <span class="round-result__text"><b>{t('hud.noWinner')}</b></span>}
      {h.roundOverIn > 0 && <small class="round-result__next">{t('hud.nextRound', { n: Math.ceil(h.roundOverIn) })}</small>}
    </div>
  );
}

// ---------------------------------------------------------------- scoreboard (hold Tab)
export function Scoreboard({ h, onClose }: { h: HudSnapshot; onClose: () => void }) {
  const r = room.value;
  return (
    <div class="scoreboard-wrap" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="scoreboard box" role="dialog" aria-label={t('hud.scoreboard')}>
        <header>
          <h2>{t('hud.scoreboard')}</h2>
          {r && !r.offline && r.isPrivate && <RoomCode code={r.code} compact />}
        </header>
        <div class="table-wrap" data-scrollable>
          <table>
            <thead>
              <tr><th class="l">{t('hud.player')}</th><th><Icon name="crown" title={t('hud.wins')} /></th><th><Icon name="gun" title={t('hud.kills')} /></th><th><Icon name="skull" title={t('hud.deaths')} /></th><th>{t('hud.ping')}</th></tr>
            </thead>
            <tbody>
              {h.players.map((p) => <ScoreRow p={p} ping={h.ping} offline={!!r?.offline} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ p, ping, offline }: { p: HudPlayer; ping: number; offline: boolean }) {
  return (
    <tr class={p.isLocal ? 'is-me' : ''} data-state={!p.inRound ? 'wait' : p.alive || p.respawning ? 'alive' : 'dead'}>
      <td class="l">
        <span class="who">
          <HeroSprite skin={p.skin} scale={0.7} still />
          <Avatar id={p.id} />
          <span class="who__name">{p.name}</span>
          {p.isBot && <span class="tag">{t('hud.bot')}</span>}
        </span>
      </td>
      <td>{p.wins}</td>
      <td>{p.kills}</td>
      <td>{p.deaths}</td>
      <td class="dim">{p.isBot ? '—' : p.isLocal ? (offline ? '—' : Math.round(ping)) : '·'}</td>
    </tr>
  );
}
