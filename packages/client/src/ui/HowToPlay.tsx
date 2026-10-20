import { Button, Modal } from './components';
import { t, tr } from './i18n';
import { CURSES, PICKUPS, type PickupGroup } from './pickups';
import { KeyBindings } from './SettingsModal';
import { PickupIcon } from './sprites';
import { closeModal } from './store';

const GROUPS: { group: PickupGroup; key: 'howto.stats' | 'howto.abilities' | 'howto.timed' }[] = [
  { group: 'stat', key: 'howto.stats' },
  { group: 'ability', key: 'howto.abilities' },
  { group: 'timed', key: 'howto.timed' },
];

export function HowToPlayModal() {
  return (
    <Modal
      title={t('howto.title')}
      onClose={() => closeModal('howto')}
      size="lg"
      footer={<Button variant="white" onClick={() => closeModal('howto')}>{t('settings.done')}</Button>}
    >
      <div class="howto">
        <section class="howto__goal">
          <h3>🎯 {t('howto.goal')}</h3>
          <p>{t('howto.goalText')}</p>
        </section>

        <section>
          <h3>🎮 {t('howto.controls')}</h3>
          <KeyBindings />
          <p class="howto__note">💡 {t('howto.action')}</p>
        </section>

        <section>
          <h3>✨ {t('howto.pickups')}</h3>
          {GROUPS.map(({ group, key }) => (
            <div class="pickup-group">
              <h4>{t(key)}</h4>
              <ul class="pickup-list">
                {PICKUPS.filter((p) => p.group === group).map((p) => (
                  <li class="pickup-card">
                    <PickupIcon type={p.type} size={40} />
                    <div>
                      <strong>{tr(p.name)}</strong>
                      <p>{tr(p.desc)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div class="pickup-group">
            <h4>💀 {t('howto.curses')}</h4>
            <ul class="pickup-list pickup-list--curses">
              {CURSES.map((c) => (
                <li class="pickup-card pickup-card--curse">
                  <span class="curse-emoji" aria-hidden="true">{c.emoji}</span>
                  <div>
                    <strong>{tr(c.name)}</strong>
                    <p>{tr(c.desc)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </Modal>
  );
}
