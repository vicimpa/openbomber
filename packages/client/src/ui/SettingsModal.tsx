import { KEY_BINDINGS, keyLabel } from '$/input/bindings';
import { Button, Kbd, Modal, Segmented, Slider, Toggle } from './components';
import { t } from './i18n';
import { Icon, type IconName } from './icons';
import { closeModal, settings, updateSettings } from './store';

const pct = (v: number) => `${Math.round(v * 100)}%`;

const ARROWS: Record<string, IconName> = { ArrowUp: 'arrowUp', ArrowDown: 'arrowDown', ArrowLeft: 'arrowLeft', ArrowRight: 'arrowRight' };

export function KeyBindings() {
  const kb = (codes: readonly string[]) => codes.map((c) => <Kbd>{ARROWS[c] ? <Icon name={ARROWS[c]} size={10} title={c} /> : keyLabel(c)}</Kbd>);
  const rows: [string, preact.ComponentChildren, preact.ComponentChildren, preact.ComponentChildren][] = [
    [t('bind.move'), <>{kb(['KeyW', 'KeyA', 'KeyS', 'KeyD'])} / {kb(['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'])}</>, t('bind.stick'), t('bind.joystick')],
    [t('bind.bomb'), kb(KEY_BINDINGS.bomb.slice(0, 2)), <><Kbd>A</Kbd><Kbd>RT</Kbd></>, t('bind.touchBomb')],
    [t('bind.action'), kb(['KeyE', 'ShiftLeft', 'KeyJ']), <><Kbd>B</Kbd><Kbd>X</Kbd><Kbd>RB</Kbd></>, t('bind.touchAction')],
    [t('bind.chat'), kb(['KeyT']), '—', <Icon name="chat" title={t('hud.chat')} />],
    [t('bind.score'), <>{kb(['Tab'])} <small>({t('bind.hold')})</small></>, <><Kbd>Back</Kbd> <small>({t('bind.hold')})</small></>, <Icon name="trophy" title={t('hud.scoreboard')} />],
    [t('bind.menu'), kb(['Escape']), <Kbd>Start</Kbd>, <Icon name="menu" title={t('hud.menu')} />],
  ];
  return (
    <div class="table-wrap" data-scrollable>
      <table class="bindings">
        <thead>
          <tr><th /><th><Icon name="keyboard" /> {t('bind.keyboard')}</th><th><Icon name="gamepad" /> {t('bind.gamepad')}</th><th><Icon name="touch" /> {t('bind.touch')}</th></tr>
        </thead>
        <tbody>
          {rows.map(([name, k, g, tc]) => (
            <tr><th scope="row">{name}</th><td>{k}</td><td>{g}</td><td>{tc}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Settings blocks, shared by the menu drawer («Настройки» tab) and the settings modal. */
export function SettingsSections({ keys = true }: { keys?: boolean }) {
  const s = settings.value;
  return (
    <div class="settings">
      <section class="settings__group">
        <h3><Icon name="speaker" /> {t('settings.audio')}</h3>
        <Slider label={t('settings.master')} min={0} max={1} step={0.05} value={s.volume.master} format={pct} onInput={(v) => updateSettings({ volume: { master: v } })} />
        <Slider label={t('settings.sfx')} min={0} max={1} step={0.05} value={s.volume.sfx} format={pct} onInput={(v) => updateSettings({ volume: { sfx: v } })} />
      </section>

      <section class="settings__group">
        <h3><Icon name="touch" /> {t('settings.touch')}</h3>
        <Slider label={t('settings.touchSize')} min={0.7} max={1.4} step={0.05} value={s.touch.size} format={pct} onInput={(v) => updateSettings({ touch: { size: v } })} />
        <Slider label={t('settings.touchOpacity')} min={0.2} max={1} step={0.05} value={s.touch.opacity} format={pct} onInput={(v) => updateSettings({ touch: { opacity: v } })} />
        <Toggle label={t('settings.leftHanded')} hint={t('settings.leftHandedHint')} checked={s.touch.leftHanded} onChange={(v) => updateSettings({ touch: { leftHanded: v } })} />
        <Toggle label={t('settings.haptics')} hint={t('settings.hapticsHint')} checked={s.haptics} onChange={(v) => updateSettings({ haptics: v })} />
      </section>

      <section class="settings__group">
        <h3><Icon name="monitor" /> {t('settings.graphics')}</h3>
        <Segmented
          label={t('settings.quality')}
          value={s.quality}
          options={[{ value: 'low', label: t('settings.qualityLow') }, { value: 'high', label: t('settings.qualityHigh') }]}
          onChange={(v) => updateSettings({ quality: v })}
        />
        <Segmented
          label={t('settings.language')}
          value={s.language}
          options={[{ value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }]}
          onChange={(v) => updateSettings({ language: v })}
        />
        <Toggle label={t('settings.showFps')} checked={s.showFps} onChange={(v) => updateSettings({ showFps: v })} />
        <Toggle label={t('settings.showPing')} checked={s.showPing} onChange={(v) => updateSettings({ showPing: v })} />
      </section>

      {keys && (
        <section class="settings__group settings__group--wide">
          <h3><Icon name="keyboard" /> {t('settings.keys')}</h3>
          <KeyBindings />
        </section>
      )}
    </div>
  );
}

export function SettingsModal() {
  return (
    <Modal
      title={t('settings.title')}
      onClose={() => closeModal('settings')}
      size="lg"
      footer={<Button variant="white" onClick={() => closeModal('settings')}>{t('settings.done')}</Button>}
    >
      <SettingsSections />
    </Modal>
  );
}
