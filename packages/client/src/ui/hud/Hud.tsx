// In-game HUD widgets. All read signals from ../store; none of them owns game state.
import { Phase, PickupType } from '@ob/game';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { canFullscreen, isFullscreen, toggleFullscreen } from '$/input/fullscreen';
import type { HudEffect, HudMe, HudPlayer, HudSnapshot } from '../hud';
import { t, tr } from '../i18n';
import { ABILITY_PICKUP, CURSE_BY_ID, PICKUP_BY_TYPE } from '../pickups';
import { HeroSprite, PickupIcon } from '../sprites';
import { actions, chatOpen, fps, killFeed, openModal, room, scoreboardOpen, settings } from '../store';
import { RoomCode } from './RoomCode';

const fmtTime = (s: number) => {
  const v = Math.ceil(s);
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

// ---------------------------------------------------------------- top bar
export function TopBar({ h }: { h: HudSnapshot }) {
  let timer: ComponentChildren;
  let mod = '';
  switch (h.phase) {
    case Phase.Waiting: timer = <span class="topbar__wait">⏳ {t('hud.waiting')}</span>; mod = 'is-wait'; break;
    case Phase.Countdown: timer = `0:0${h.countdown}`; break;
    case Phase.Playing: timer = fmtTime(h.timeLeft); if (h.timeLeft <= 10) mod = 'is-warn'; break;
    case Phase.SuddenDeath: timer = <span>💀 SD</span>; mod = 'is-sd'; break;
    case Phase.RoundOver: timer = '🏁'; break;
  }
  return (
    <div class="topbar hud-panel">
      <div class="topbar__cell topbar__round">
        <small>{t('hud.round', { n: '' }).trim()}</small>
        <b class="pixel">{h.round || '–'}</b>
      </div>
      <div class={`topbar__timer pixel ${mod}`} role="timer">{timer}</div>
      <div class="topbar__cell topbar__alive" title={t('hud.alive')}>
        <small>{t('hud.alive')}</small>
        <b class="pixel">{h.alive}<i>/{h.total}</i></b>
      </div>
    </div>
  );
}

export function NetStats({ ping }: { ping: number }) {
  const s = settings.value;
  const offline = room.value?.offline;
  if (!s.showFps && !s.showPing) return null;
  const pingClass = ping < 80 ? 'good' : ping < 160 ? 'mid' : 'bad';
  return (
    <div class="netstats">
      {s.showPing && (offline
        ? <span class="netstats__chip">{t('hud.offline')}</span>
        : <span class={`netstats__chip is-${pingClass}`}>{Math.round(ping)} ms</span>)}
      {s.showFps && <span class="netstats__chip">{fps.value} {t('hud.fps')}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- stats panel
function Heart({ on = true }: { on?: boolean }) {
  return (
    <svg class={`heart ${on ? '' : 'is-off'}`} viewBox="0 0 7 6" width="14" height="12" aria-hidden="true" shape-rendering="crispEdges">
      <path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z" />
      <path class="heart__shine" d="M1 1h1v1H1z" />
    </svg>
  );
}

const EFFECT_ICON: Record<HudEffect['kind'], PickupType | string> = {
  shield: PickupType.Shield, ghost: PickupType.Ghost, crazy: PickupType.Crazy, fire: PickupType.Fire,
  curse: '💀', invulnerable: '✨', stun: '💫',
};

function EffectRing({ e, compact }: { e: HudEffect; compact: boolean }) {
  const icon = EFFECT_ICON[e.kind];
  const curse = e.kind === 'curse' && e.curse ? CURSE_BY_ID.get(e.curse) : undefined;
  const name = curse ? tr(curse.name) : t(`effect.${e.kind}` as 'effect.shield');
  const size = compact ? 22 : 30;
  return (
    <div class={`fx fx--${e.kind} ${e.left < 3 ? 'is-ending' : ''}`} title={name} style={{ '--frac': e.frac }}>
      <div class="fx__ring">
        {curse ? <span class="fx__emoji">{curse.emoji}</span>
          : typeof icon === 'number' ? <PickupIcon type={icon} size={size - 6} />
          : <span class="fx__emoji">{icon}</span>}
      </div>
      <div class="fx__meta">
        {!compact && <span class="fx__name">{name}</span>}
        <span class="fx__time">{Math.ceil(e.left)}{compact ? '' : 's'}</span>
      </div>
    </div>
  );
}

function Stat({ type, value, label, extra, compact }: { type: PickupType; value: number | string; label: string; extra?: ComponentChildren; compact?: boolean }) {
  return (
    <div class="stat" title={label}>
      <PickupIcon type={type} size={compact ? 20 : 24} />
      <b key={String(value)} class="stat__val pop">{value}</b>
      {extra}
    </div>
  );
}

export function StatsPanel({ me, compact }: { me: HudMe; compact: boolean }) {
  const hearts = (me.alive ? 1 : 0) + me.lives;
  const free = Math.max(0, me.bombs - me.bombsPlaced);
  return (
    <div class={`stats hud-panel ${compact ? 'stats--compact' : ''} ${me.spectating ? 'is-dead' : ''}`}>
      <div class="stats__head">
        <HeroSprite skin={me.skin} anim={me.carrying ? 'IdleDownBomb' : 'IdleDown'} scale={compact ? 0.9 : 1.1} still={!me.alive} />
        <div class="stats__who">
          <span class="stats__name">{me.name}</span>
          <span class="stats__hearts" title={t('hud.lives')}>
            {hearts > 0 ? Array.from({ length: Math.min(hearts, 5) }, () => <Heart />) : <Heart on={false} />}
            {hearts > 5 && <small>×{hearts}</small>}
          </span>
        </div>
      </div>
      <div class="stats__nums">
        <Stat compact={compact} type={PickupType.BombUp} value={me.bombs} label={t('hud.bombs')}
          extra={!compact && <span class="pips">{Array.from({ length: me.bombs }, (_, i) => <i class={i < free ? 'is-on' : ''} />)}</span>} />
        <Stat compact={compact} type={PickupType.FireUp} value={me.radius} label={t('hud.radius')} />
        <Stat compact={compact} type={PickupType.SpeedUp} value={me.speedLevel + 1} label={t('hud.speed')} />
      </div>
      {me.abilities.length > 0 && (
        <div class="stats__abil">
          {me.abilities.map((a) => {
            const p = ABILITY_PICKUP.get(a)!;
            const info = PICKUP_BY_TYPE.get(p);
            return <span key={a} class="pop"><PickupIcon type={p} size={compact ? 20 : 26} title={info ? tr(info.name) : ''} /></span>;
          })}
        </div>
      )}
      {me.effects.length > 0 && (
        <div class="stats__fx">
          {me.effects.map((e) => <EffectRing key={e.kind} e={e} compact={compact} />)}
        </div>
      )}
      {compact && me.curse !== 0 && CURSE_BY_ID.get(me.curse) && (
        <div class="stats__curse">💀 {tr(CURSE_BY_ID.get(me.curse)!.name)}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- kill feed
export function KillFeed() {
  const list = killFeed.value;
  return (
    <ol class="killfeed" aria-live="polite">
      {list.map((k) => (
        <li key={k.id} class={`kill ${k.victim.isLocal || k.killer?.isLocal ? 'kill--me' : ''}`}>
          {k.kind === 'kill' && k.killer && <>
            <HeroSprite skin={k.killer.skin} scale={0.6} still />
            <span class={k.killer.isLocal ? 'kill__me' : ''}>{k.killer.name}</span>
            <span class="kill__icon">💥</span>
          </>}
          {k.kind === 'self' && <span class="kill__icon">🤦</span>}
          {k.kind === 'world' && <span class="kill__icon">🧱</span>}
          <HeroSprite skin={k.victim.skin} scale={0.6} still />
          <span class={`kill__victim ${k.victim.isLocal ? 'kill__me' : ''}`}>{k.victim.name}</span>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- scoreboard
export function Scoreboard({ h, onClose }: { h: HudSnapshot; onClose: () => void }) {
  const r = room.value;
  return (
    <div class="scoreboard-wrap" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="scoreboard hud-panel" role="dialog" aria-label={t('hud.scoreboard')}>
        <header>
          <h2 class="pixel">🏆 {t('hud.scoreboard')}</h2>
          <span class="scoreboard__round">{t('hud.round', { n: h.round })}</span>
          {r && !r.offline && <RoomCode code={r.code} compact />}
        </header>
        <div class="table-wrap" data-scrollable>
          <table>
            <thead>
              <tr><th>#</th><th class="l">{t('hud.player')}</th><th title={t('hud.wins')}>🏆</th><th title={t('hud.kills')}>💥</th><th title={t('hud.deaths')}>💀</th><th>{t('hud.ping')}</th></tr>
            </thead>
            <tbody>
              {h.players.map((p, i) => <ScoreRow p={p} i={i} ping={h.ping} offline={!!r?.offline} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ p, i, ping, offline }: { p: HudPlayer; i: number; ping: number; offline: boolean }) {
  return (
    <tr class={`${p.isLocal ? 'is-me' : ''} ${!p.alive || !p.inRound ? 'is-dead' : ''}`}>
      <td class="pixel">{i + 1}</td>
      <td class="l">
        <span class="who">
          <HeroSprite skin={p.skin} scale={0.7} still />
          <span class="who__name">{p.name}</span>
          {p.isBot && <span class="tag">{t('hud.bot')}</span>}
          {p.isLocal && <span class="tag tag--me">{t('hud.you')}</span>}
        </span>
      </td>
      <td class="pixel">{p.wins}</td>
      <td>{p.kills}</td>
      <td>{p.deaths}</td>
      <td class="dim">{p.isBot ? '—' : p.isLocal ? (offline ? '—' : Math.round(ping)) : '·'}</td>
    </tr>
  );
}

// ---------------------------------------------------------------- center overlays
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
    return <div class="center-big" aria-live="assertive"><span key={h.countdown} class="countdown pixel">{h.countdown}</span></div>;
  if (go) return <div class="center-big"><span class="countdown countdown--go pixel">{t('hud.go')}</span></div>;
  return null;
}

export function SuddenDeathBanner({ h }: { h: HudSnapshot }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!h.suddenDeath) { setShow(false); return; }
    setShow(true);
    const id = setTimeout(() => setShow(false), 3200);
    return () => clearTimeout(id);
  }, [h.suddenDeath]);
  if (show) return (
    <div class="banner banner--sd" role="alert">
      <b class="pixel">⚠ {t('hud.suddenDeath')}</b>
      <span>{t('hud.suddenDeathSub')}</span>
    </div>
  );
  if (h.phase === Phase.Playing && h.timeLeft <= 10 && h.timeLeft > 0)
    return <div class="banner banner--warn"><span>⏰ {t('hud.suddenSoon')}</span></div>;
  return null;
}

export function SpectatorBanner({ me, phase }: { me: HudMe; phase: Phase }) {
  if (phase === Phase.RoundOver) return null;
  if (me.respawnIn > 0)
    return <div class="spectator hud-panel"><b>💫 {t('hud.respawn', { n: me.respawnIn.toFixed(1) })}</b></div>;
  if (!me.spectating) return null;
  const joined = me.inRound;
  return (
    <div class="spectator hud-panel">
      <b>{joined ? `☠️ ${t('hud.eliminated')}` : `👀 ${t('hud.spectating')}`}</b>
      <span>{joined ? t('hud.eliminatedSub') : t('hud.spectatingSub')}</span>
    </div>
  );
}

export function RoundOver({ h }: { h: HudSnapshot }) {
  if (h.phase !== Phase.RoundOver) return null;
  const w = h.winner;
  const top = h.players.filter((p) => p.inRound || p.wins > 0).slice(0, 6);
  return (
    <div class="roundover" role="dialog" aria-live="assertive">
      <div class="roundover__card hud-panel">
        <span class="roundover__label">{w ? (w.isLocal ? '' : t('hud.winner')) : ''}</span>
        {w ? <>
          <div class="roundover__hero"><HeroSprite skin={w.skin} anim="RunDown" scale={4} /><div class="confetti" /></div>
          <h2 class="pixel roundover__name">{w.isLocal ? `🎉 ${t('hud.youWon')}` : w.name}</h2>
        </> : <h2 class="pixel roundover__name">🤝 {t('hud.draw')}</h2>}
        <ol class="standings">
          {top.map((p) => (
            <li class={`${p.isLocal ? 'is-me' : ''} ${w && p.id === w.id ? 'is-winner' : ''}`}>
              <HeroSprite skin={p.skin} scale={0.7} still />
              <span class="standings__name">{p.name}</span>
              <span class="standings__wins pixel">{p.wins} 🏆</span>
            </li>
          ))}
        </ol>
        <p class="roundover__next">{t('hud.nextRound', { n: Math.ceil(h.roundOverIn) })}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- buttons
function HudBtn({ icon, label, onClick, on }: { icon: string; label: string; onClick: () => void; on?: boolean }) {
  return (
    <button
      class={`hud-btn ${on ? 'is-on' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => { actions.uiSound('click'); onClick(); }}
      title={label}
      aria-label={label}
      aria-pressed={on}
      tabIndex={-1}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

export function HudButtons({ touch }: { touch: boolean }) {
  return (
    <div class="hud-btns">
      {touch && <HudBtn icon="💬" label={t('hud.chat')} on={chatOpen.value} onClick={() => { chatOpen.value = !chatOpen.value; }} />}
      <HudBtn icon="🏆" label={t('hud.scoreboard')} on={scoreboardOpen.value} onClick={() => { scoreboardOpen.value = !scoreboardOpen.value; }} />
      {touch && canFullscreen && <HudBtn icon={isFullscreen.value ? '🗗' : '⛶'} label={t('hud.fullscreen')} onClick={() => { toggleFullscreen(); }} />}
      <HudBtn icon="☰" label={t('hud.menu')} onClick={() => openModal('pause')} />
    </div>
  );
}
