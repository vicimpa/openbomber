import { PickupType, type ControlHint, type ControlKind, type ControlHints } from '@ob/game';
import { KEY_BINDINGS, PAD, PAD_BINDINGS, keyLabel } from '$/input/bindings';
import { lastDevice } from '$/input/device';
import { Kbd } from '../components';
import { t } from '../i18n';
import { PickupIcon } from '../sprites';

const ICON: Record<ControlKind, PickupType> = {
  bomb: PickupType.BombUp, lineBomb: PickupType.LineBomb, grab: PickupType.Glove,
  throw: PickupType.Glove, punch: PickupType.Punch, remote: PickupType.Remote, teleport: PickupType.Teleport,
};
const SLOTS = ['bomb', 'action', 'punch', 'detonate', 'teleport'] as const;

function Control({ slot, hint }: { slot: typeof SLOTS[number]; hint: ControlHint }) {
  const ready = hint.reason === 'ready';
  const binding = lastDevice.value === 'gamepad'
    ? Object.keys(PAD).find((k) => PAD[k as keyof typeof PAD] === PAD_BINDINGS[slot][0])!
    : keyLabel(KEY_BINDINGS[slot][0]);
  const label = t(`control.${hint.kind}`);
  const detail = hint.reason === 'noAbility'
    ? t(hint.kind === 'grab' ? 'control.needGlove' : hint.kind === 'punch' ? 'control.needPunch' : 'control.needRemote')
    : hint.reason === 'ready' ? t(hint.kind === 'throw' ? 'control.release' : hint.kind === 'grab' ? 'control.hold' : 'control.press')
      : t(`control.${hint.reason}`);
  return (
    <div class={`control-hint ${ready ? 'is-ready' : 'is-unavailable'}`} role="group" aria-disabled={!ready} aria-label={`${label} (${binding}): ${detail}`} title={`${label} (${binding}): ${detail}`}>
      <div class="control-hint__icon">
        <PickupIcon type={ICON[hint.kind]} size={32} />
        {hint.count !== undefined && <span class="control-hint__count">{hint.count}</span>}
      </div>
      <Kbd>{binding}</Kbd>
    </div>
  );
}

/** Persistent reminders: even missing abilities stay visible with a reason. */
export function Controls({ hints }: { hints: ControlHints }) {
  return (
    <div class="control-hints" role="group" aria-label={t('control.title')}>
      {SLOTS.map((slot) => <Control key={slot} slot={slot} hint={hints[slot]} />)}
    </div>
  );
}
