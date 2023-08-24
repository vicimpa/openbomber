import { toLimit } from "@/toLimit";
import { ESounds } from "@/types";

import type { Vec2 } from "@/Vec2";
const audioCtx = new (AudioContext || (window as any)['webkitAudioContext']) as AudioContext;
export const gainNode = audioCtx.createGain();


let connected = false;

addEventListener('mousedown', () => {
  connected = true;
}, { once: true });

addEventListener('touchstart', () => {
  connected = true;
}, { once: true });

addEventListener('keydown', () => {
  connected = true;
}, { once: true });

export class Sound {
  #buffer!: AudioBuffer;
  static #current = 0;

  constructor(src = '') {
    this.loadSound(src);
  }

  loadSound(src = '') {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', src, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      audioCtx.decodeAudioData(xhr.response)
        .then((buffer) => {
          this.#buffer = buffer;
        }, console.error);
    };
    xhr.send();
  }

  play(vec?: Vec2) {
    if (!connected) return;

    const src = audioCtx.createBufferSource();

    src.buffer = this.#buffer;

    if (vec) {
      const panner = audioCtx.createPanner();
      vec.normalize().div(4);
      panner.positionX.value = -vec.x;
      panner.positionY.value = vec.y;
      panner.positionZ.value = 0;
      panner.orientationX.value = 0;
      panner.orientationY.value = 0;
      panner.orientationZ.value = -1;
      panner.coneOuterGain = 1;
      panner.coneInnerAngle = 60;
      panner.coneOuterAngle = 90;
      panner.rolloffFactor = 10;
      panner.refDistance = 1;
      panner.maxDistance = 10000;
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'linear';

      src.connect(panner);
      panner.connect(gainNode);

      src.onended = () => {
        panner.disconnect(gainNode);
        src.disconnect(panner);
        src.onended = null;
      };
    } else {
      src.connect(gainNode);

      src.onended = () => {
        src.disconnect(gainNode);
        src.onended = null;
      };
    }
    src.start(0);
  }

  static test() {
    const values = Object.values(sounds);
    values[this.#current++ % values.length]?.play();
  }
}

gainNode.connect(audioCtx.destination);

export const soundStore = {
  [ESounds.win]: await import('sound/win.mp3?url'),
  [ESounds.bonus]: await import('sound/bonus.wav?url'),
  [ESounds.death]: await import('sound/death.wav?url'),
  [ESounds.putBomb]: await import('sound/put_bomb.mp3?url'),
  [ESounds.explode]: await import('sound/explode.mp3?url'),
  [ESounds.newLife]: await import('sound/new_life.wav?url'),
  [ESounds.message]: await import('sound/message.mp3?url'),
  [ESounds.shield]: await import('sound/shield.mp3?url'),
  [ESounds.crazy]: await import('sound/crazy.mp3?url'),
  [ESounds.explodeFail]: await import('sound/explode_fail.mp3?url'),
  [ESounds.fireOn]: await import('sound/fire_on.mp3?url'),
  [ESounds.fireOff]: await import('sound/fire_off.mp3?url'),
  [ESounds.speedOn]: await import('sound/speed_on.mp3?url'),
  [ESounds.speedOff]: await import('sound/speed_off.mp3?url'),
  [ESounds.kill]: await import('sound/kill.mp3?url'),
  [ESounds.moving]: await import('sound/moving.mp3'),
};

type TUrl = typeof import('*?url');
type TStore = {
  [key: string]: TUrl;
};

export const sounds = (
  <T extends TStore>(obj: T) => {
    return Object.entries(obj)
      .reduce((acc, [key, value]: [keyof T, TUrl]) => {
        acc[key] = new Sound(value.default);
        return acc;
      }, {} as { [key in keyof T]: Sound });
  }
)(soundStore);

export const playSound = (sound: ESounds) => {
  sounds[sound]?.play();
};