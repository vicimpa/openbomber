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

  constructor(src: TUrl | Promise<TUrl>) {
    Promise.resolve()
      .then(() => src)
      .then(src => this.loadSound(src.default));
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
  [ESounds.win]: import('sound/win.mp3'),
  [ESounds.bonus]: import('sound/bonus.wav'),
  [ESounds.death]: import('sound/death.wav'),
  [ESounds.putBomb]: import('sound/put_bomb.mp3'),
  [ESounds.explode]: import('sound/explode.mp3'),
  [ESounds.newLife]: import('sound/new_life.wav'),
  [ESounds.message]: import('sound/message.mp3'),
  [ESounds.shield]: import('sound/shield.mp3'),
  [ESounds.crazy]: import('sound/crazy.mp3'),
  [ESounds.explodeFail]: import('sound/explode_fail.mp3'),
  [ESounds.fireOn]: import('sound/fire_on.mp3'),
  [ESounds.fireOff]: import('sound/fire_off.mp3'),
  [ESounds.speedOn]: import('sound/speed_on.mp3'),
  [ESounds.speedOff]: import('sound/speed_off.mp3'),
  [ESounds.kill]: import('sound/kill.mp3'),
  [ESounds.moving]: import('sound/moving.mp3'),
};

type TUrl = typeof import('*.mp3');
type TStore = {
  [key: string]: TUrl | Promise<TUrl>;
};

export const sounds = (
  <T extends TStore>(obj: T) => {
    return Object.entries(obj)
      .reduce((acc, [key, value]: [keyof T, TUrl | Promise<TUrl>]) => {
        acc[key] = new Sound(value);
        return acc;
      }, {} as { [key in keyof T]: Sound });
  }
)(soundStore);

export const playSound = (sound: ESounds) => {
  sounds[sound]?.play();
};