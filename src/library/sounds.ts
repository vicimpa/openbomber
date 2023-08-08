const audioCtx = new (AudioContext || (window as any)['webkitAudioContext']) as AudioContext;
const gainNode = audioCtx.createGain();

export class Sound {
  #buffer!: AudioBuffer;

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
    const src = audioCtx.createBufferSource();
    src.buffer = this.#buffer;
    src.connect(gainNode);
    src.start(0);
    src.onended = () => {
      src.disconnect(gainNode);
      src.onended = null;
    };
  }
}

gainNode.gain.value = .2;
gainNode.connect(audioCtx.destination);

export const soundStore = {
  win: await import('sound/win.mp3?url'),
  bonus: await import('sound/bonus.wav?url'),
  death: await import('sound/death.wav?url'),
  putBomb: await import('sound/put_bomb.mp3?url'),
  explode: await import('sound/explode.mp3?url'),
  newLife: await import('sound/new_life.wav?url'),
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