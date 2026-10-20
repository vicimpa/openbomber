// Pixel bitmap font for name tags and floating labels (Monocraft, rasterised once, nearest filtered).
import { BitmapFont } from 'pixi.js';
import { FONT } from './assets';

export const FONT_TAG = 'ob-tag';

export function installFonts() {
  BitmapFont.install({
    name: FONT_TAG,
    style: {
      fontFamily: [FONT, 'monospace'],
      fontSize: 8,
      fill: 0xffffff,
      stroke: { color: 0x1a1426, width: 2, join: 'round' },
    },
    chars: [[' ', '~'], ['А', 'я'], 'Ёё№'],
    resolution: 2,
    padding: 2,
    textureStyle: { scaleMode: 'nearest' },
  });
}
