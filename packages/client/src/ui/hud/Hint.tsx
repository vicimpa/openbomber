// Power-up hint (Glove / Teleport): which key to press, for keyboard and gamepad players.
import { lastDevice } from '$/input/device';
import { KEY_BINDINGS, PAD, PAD_BINDINGS, keyLabel } from '$/input/bindings';
import { Kbd } from '../components';
import { t, tr } from '../i18n';
import { PICKUP_BY_TYPE } from '../pickups';
import { PickupIcon } from '../sprites';
import { HINT_PICKUP, hint } from '../store';

const padName = (button: number) => Object.keys(PAD).find((k) => PAD[k as keyof typeof PAD] === button) ?? String(button);

export function Hint() {
  const h = hint.value;
  if (!h) return null;
  const binding = h.kind === 'glove' ? 'action' : 'teleport';
  const key = lastDevice.value === 'gamepad' ? padName(PAD_BINDINGS[binding][0]) : keyLabel(KEY_BINDINGS[binding][0]);
  const type = HINT_PICKUP[h.kind];
  const info = PICKUP_BY_TYPE.get(type);
  const parts = t(h.kind === 'glove' ? 'hint.glove' : 'hint.teleport').split('{key}');
  return (
    <div key={h.id} class="hint" role="status">
      <PickupIcon type={type} size={32} />
      <p>
        {info && <b>{tr(info.name)}. </b>}
        {parts.map((s, i) => <>{i > 0 && <Kbd>{key}</Kbd>}{s}</>)}
      </p>
    </div>
  );
}
