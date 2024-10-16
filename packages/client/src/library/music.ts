import { audioCtx, connected, gainNode } from "./sounds";

import { delay } from "@ob/core/delay";

const playlist = [
  '1.mp3',
  '2.mp3',
  '3.mp3',
  '4.mp3',
  '5.mp3',
  '6.mp3',
  '7.mp3',
  '8.mp3',
  '9.mp3',
  '10.mp3',
  '11.mp3',
  '12.mp3',
  '13.mp3',
  '14.mp3'
];
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
    audio.src = '/music/' + playlist[current];
    await audio.play().catch(() => { });
  }
};

import.meta.hot?.on('vite:beforePrune', () => {
  run = false;
});

main().catch(e => console.error(e));