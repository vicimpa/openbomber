// Theme and weather of a round: purely cosmetic (the client dresses the arena and the countryside
// and draws the weather), picked by the sim with the map so every client shows the same one.

import { Theme, Weather } from '../contract/types';
import { nextFloat, type SeedHolder } from './rng';

const THEME_WEIGHTS: readonly number[] = [4, 2, 2, 2]; // by Theme

/** Weather odds per theme, by Weather: no snow outside winter, no rain in the desert. */
const WEATHER_WEIGHTS: Record<Theme, readonly number[]> = {
  //                  Clear Rain Storm Snow Fog Wind Night
  [Theme.Meadow]: [4, 2, 1, 0, 1, 2, 2],
  [Theme.Autumn]: [2, 2, 1, 0, 2, 3, 1],
  [Theme.Winter]: [2, 0, 0, 4, 1, 1, 2],
  [Theme.Desert]: [4, 0, 0, 0, 0, 3, 2],
};

function pick(rng: SeedHolder, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let r = nextFloat(rng) * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r < 0) return i;
  }
  return 0;
}

export function pickTheme(rng: SeedHolder): Theme {
  return pick(rng, THEME_WEIGHTS) as Theme;
}

export function pickWeather(rng: SeedHolder, theme: Theme): Weather {
  return pick(rng, WEATHER_WEIGHTS[theme]) as Weather;
}
