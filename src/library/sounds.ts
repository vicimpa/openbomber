import { ESounds } from "@/types";

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

  play() {
    if (!connected) return;
    const src = audioCtx.createBufferSource();
    src.buffer = this.#buffer;
    src.connect(gainNode);
    src.start(0);
    src.onended = () => {
      src.disconnect(gainNode);
      src.onended = null;
    };
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