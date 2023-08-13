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
  win: await import('sound/win.mp3?url'),
  bonus: await import('sound/bonus.wav?url'),
  death: await import('sound/death.wav?url'),
  putBomb: await import('sound/put_bomb.mp3?url'),
  explode: await import('sound/explode.mp3?url'),
  newLife: await import('sound/new_life.wav?url'),
  message: await import('sound/message.mp3?url'),
  shield: await import('sound/shield.mp3?url'),
  crazy: await import('sound/crazy.mp3?url'),
  explodeFail: await import('sound/explode_fail.mp3?url'),
  fireOn: await import('sound/fire_on.mp3?url'),
  fireOff: await import('sound/fire_off.mp3?url'),
  speedOn: await import('sound/speed_on.mp3?url'),
  speedOff: await import('sound/speed_off.mp3?url')
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