const A_RU = ['Бодрый', 'Хитрый', 'Огненный', 'Шустрый', 'Грозный', 'Весёлый', 'Ловкий', 'Дикий', 'Тихий', 'Бешеный', 'Ржавый', 'Пиксельный'];
const B_RU = ['Фитиль', 'Бабах', 'Сапёр', 'Ёжик', 'Кот', 'Динамит', 'Пончик', 'Барсук', 'Енот', 'Тротил', 'Гном', 'Кактус'];
const A_EN = ['Boomy', 'Sneaky', 'Fiery', 'Swift', 'Mighty', 'Lucky', 'Wild', 'Silent', 'Crazy', 'Rusty', 'Pixel', 'Turbo'];
const B_EN = ['Fuse', 'Kaboom', 'Sapper', 'Hedgehog', 'Cat', 'Dynamite', 'Donut', 'Badger', 'Raccoon', 'Bomber', 'Gnome', 'Cactus'];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export const NAME_MAX = 16;

export function randomName(lang: 'ru' | 'en' = 'ru'): string {
  for (let i = 0; i < 30; i++) {
    const name = lang === 'ru' ? `${pick(A_RU)} ${pick(B_RU)}` : `${pick(A_EN)}${pick(B_EN)}`;
    if (name.length <= NAME_MAX) return name;
  }
  return lang === 'ru' ? 'Бомбер' : 'Bomber';
}
