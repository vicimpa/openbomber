import { delay } from "core/delay";

import { audioCtx, connected, gainNode } from "./sounds";

const data = import.meta.glob("/music/*.mp3");
const playlist = Object.keys(data);
const audio = new Audio();
const audioNode = audioCtx.createMediaElementSource(audio);

let current = +(localStorage.getItem('music') ?? '-1');
let run = true;

audio.volume = 0.25;
audioNode.connect(gainNode);

const main = async () => {
  while (run) {
    await delay(100);
    if (!connected) continue;
    if (!audio.paused) continue;
    current++;
    if (!playlist[current]) current = 0;
    localStorage.setItem('music', current + '');
    const mod = data[playlist[current]];
    await Promise.resolve()
      .then(e => mod())
      .then((e: any) => {
        const { default: src } = e as any as { default: string; };
        if (audio) audio.src = src;
      });

    await audio.play().catch(() => { });
  }
};

import.meta.hot?.on('vite:beforePrune', () => {
  run = false;
});

main().catch(e => console.error(e));