// Pickup / ability / curse metadata for the UI (icons, names, descriptions).
import { Ability, Curse, PickupType } from '@ob/game';

export type PickupGroup = 'stat' | 'ability' | 'timed';

export interface PickupInfo {
  type: PickupType;
  group: PickupGroup;
  /** Legacy tag in assets/bonuses (unused now: icons come from assets/pickups by PickupType name). */
  sprite?: string;
  /** Fallback glyph if the atlas frame is missing. */
  emoji: string;
  /** Accent colour used behind emoji placeholders. */
  color: string;
  name: { ru: string; en: string };
  desc: { ru: string; en: string };
}

export const PICKUPS: PickupInfo[] = [
  { type: PickupType.BombUp, group: 'stat', sprite: 'append', emoji: '💣', color: '#3b7dd8',
    name: { ru: 'Ещё бомба', en: 'Bomb up' },
    desc: { ru: '+1 бомба, которую можно поставить одновременно.', en: '+1 bomb you can have on the field at once.' } },
  { type: PickupType.FireUp, group: 'stat', sprite: 'radius', emoji: '🔥', color: '#d8453b',
    name: { ru: 'Сильнее огонь', en: 'Fire up' },
    desc: { ru: '+1 к радиусу взрыва.', en: '+1 explosion radius.' } },
  { type: PickupType.SpeedUp, group: 'stat', sprite: 'speed', emoji: '👟', color: '#2fae6b',
    name: { ru: 'Скорость', en: 'Speed up' },
    desc: { ru: 'Бегаете быстрее 25 с. Время складывается и гасит огонь.', en: 'Run faster for 25 s. Stacks time and cancels Fire.' } },
  { type: PickupType.FullFire, group: 'stat', emoji: '🌋', color: '#ff6a00',
    name: { ru: 'Полный огонь', en: 'Full fire' },
    desc: { ru: 'Радиус взрыва сразу на максимум.', en: 'Explosion radius jumps to the maximum.' } },

  { type: PickupType.Kick, group: 'ability', sprite: 'kick', emoji: '🦶', color: '#c2532f',
    name: { ru: 'Пинок', en: 'Kick' },
    desc: { ru: 'Упритесь в бомбу, и она покатится до препятствия. 35 с.', en: 'Walk into a bomb to kick it until it hits something. 35 s.' } },
  { type: PickupType.Glove, group: 'ability', emoji: '🧤', color: '#8e5bd6',
    name: { ru: 'Перчатка', en: 'Glove' },
    desc: { ru: '«Действие» у бомбы: схватить, отпустить — бросить через стены. 35 с.', en: 'Action near a bomb grabs it; release to throw it over walls. 35 s.' } },
  { type: PickupType.Punch, group: 'ability', emoji: '🥊', color: '#d63b6a',
    name: { ru: 'Кулак', en: 'Punch' },
    desc: { ru: '«Действие» лицом к бомбе отбрасывает её на 3 клетки. 35 с.', en: 'Action facing a bomb punches it 3 tiles away. 35 s.' } },
  { type: PickupType.Remote, group: 'ability', emoji: '📡', color: '#2f9fd6',
    name: { ru: 'Пульт', en: 'Remote' },
    desc: { ru: 'Бомбы ждут сигнала: «Действие» взрывает самую старую. 30 с.', en: 'Bombs wait for a signal: Action detonates the oldest one. 30 s.' } },
  { type: PickupType.Pierce, group: 'ability', emoji: '🗡️', color: '#d6a12f',
    name: { ru: 'Пробивной огонь', en: 'Pierce' },
    desc: { ru: 'Пламя проходит сквозь кирпичи. 30 с.', en: 'Flames go through bricks. 30 s.' } },
  { type: PickupType.LineBomb, group: 'ability', emoji: '⛓️', color: '#5f6bd6',
    name: { ru: 'Линия бомб', en: 'Line bomb' },
    desc: { ru: 'Стоя на своей бомбе, нажмите «Бомба»: линия бомб по взгляду. 35 с.', en: 'Press Bomb on your own bomb to drop a whole line. 35 s.' } },
  { type: PickupType.BombPass, group: 'ability', emoji: '👣', color: '#3fbfae',
    name: { ru: 'Сквозь бомбы', en: 'Bomb pass' },
    desc: { ru: 'Проходите сквозь бомбы. 30 с.', en: 'Walk through bombs. 30 s.' } },

  { type: PickupType.Shield, group: 'timed', sprite: 'shield', emoji: '🛡️', color: '#2f8fd6',
    name: { ru: 'Щит', en: 'Shield' },
    desc: { ru: 'Снимается первым же взрывом. 50 с.', en: 'Absorbs the first explosion. 50 s.' } },
  { type: PickupType.Ghost, group: 'timed', emoji: '👻', color: '#9aa3c7',
    name: { ru: 'Призрак', en: 'Ghost' },
    desc: { ru: 'Проходите сквозь кирпичи. 30 с.', en: 'Walk through bricks. 30 s.' } },
  { type: PickupType.Crazy, group: 'timed', sprite: 'ebomb', emoji: '🤪', color: '#b53fd6',
    name: { ru: 'Безумные бомбы', en: 'Crazy bombs' },
    desc: { ru: 'Взрыв через 0.5–5 с, радиус до ×5, 10% не взорвётся. 30 с.', en: 'Fuse 0.5–5 s, radius up to ×5, 10% fizzle. 30 s.' } },
  { type: PickupType.Fire, group: 'timed', sprite: 'fire', emoji: '☄️', color: '#ff4d1f',
    name: { ru: 'Огненный', en: 'On fire' },
    desc: { ru: 'Вы горите: медленнее, но касание убивает. 25 с.', en: 'You are on fire: slower, but your touch kills. 25 s.' } },
  { type: PickupType.Heart, group: 'timed', emoji: '❤️', color: '#d62f4a',
    name: { ru: 'Сердце', en: 'Heart' },
    desc: { ru: '+1 жизнь: после смерти вы возродитесь.', en: '+1 life: you respawn after dying.' } },
  { type: PickupType.Skull, group: 'timed', emoji: '💀', color: '#6b6b7a',
    name: { ru: 'Череп', en: 'Skull' },
    desc: { ru: 'Случайное проклятие на 15 секунд. Заразно при касании!', en: 'A random curse for 15 seconds. Contagious on touch!' } },
  { type: PickupType.Random, group: 'timed', sprite: 'random', emoji: '❓', color: '#6b8fd6',
    name: { ru: 'Сюрприз', en: 'Random' },
    desc: { ru: 'Превращается в случайный бонус.', en: 'Turns into a random power-up.' } },
];

export const PICKUP_BY_TYPE = new Map(PICKUPS.map((p) => [p.type, p]));

export const ABILITY_LIST: { ability: Ability; pickup: PickupType }[] = [
  { ability: Ability.Kick, pickup: PickupType.Kick },
  { ability: Ability.Glove, pickup: PickupType.Glove },
  { ability: Ability.Punch, pickup: PickupType.Punch },
  { ability: Ability.Remote, pickup: PickupType.Remote },
  { ability: Ability.Pierce, pickup: PickupType.Pierce },
  { ability: Ability.LineBomb, pickup: PickupType.LineBomb },
  { ability: Ability.BombPass, pickup: PickupType.BombPass },
];

export const ABILITY_PICKUP = new Map(ABILITY_LIST.map((a) => [a.ability, a.pickup]));

export interface CurseInfo { curse: Curse; emoji: string; name: { ru: string; en: string }; desc: { ru: string; en: string } }

export const CURSES: CurseInfo[] = [
  { curse: Curse.Reverse, emoji: '🔄', name: { ru: 'Наоборот', en: 'Reverse' }, desc: { ru: 'Управление инвертировано.', en: 'Controls are inverted.' } },
  { curse: Curse.Diarrhea, emoji: '💩', name: { ru: 'Понос', en: 'Diarrhea' }, desc: { ru: 'Бомбы сыплются сами.', en: 'You drop bombs non-stop.' } },
  { curse: Curse.Constipation, emoji: '🚫', name: { ru: 'Запор', en: 'Constipation' }, desc: { ru: 'Нельзя ставить бомбы.', en: 'You cannot drop bombs.' } },
  { curse: Curse.Slow, emoji: '🐌', name: { ru: 'Улитка', en: 'Slow' }, desc: { ru: 'Очень медленно.', en: 'Very slow.' } },
  { curse: Curse.Fast, emoji: '⚡', name: { ru: 'Турбо', en: 'Fast' }, desc: { ru: 'Слишком быстро.', en: 'Way too fast.' } },
  { curse: Curse.TinyFlame, emoji: '🕯️', name: { ru: 'Искра', en: 'Tiny flame' }, desc: { ru: 'Радиус взрыва 1.', en: 'Explosion radius is 1.' } },
];

export const CURSE_BY_ID = new Map(CURSES.map((c) => [c.curse, c]));
