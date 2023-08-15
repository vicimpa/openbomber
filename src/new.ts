import { PlayerSetPosition } from "@/proto";

import App from "./new.svelte";

new App({
  target: document.getElementById('app')!
});

const buffer = PlayerSetPosition.from({
  x: 0.2,
  y: 0.3,
  dir: 1,
  animate: 2
});

console.log(PlayerSetPosition.to(buffer));

console.log(buffer.byteLength);