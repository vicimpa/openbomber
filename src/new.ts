import { PlayerSetPositionProto } from "@/proto";

// import App from "./new.svelte";

// new App({
//   target: document.getElementById('app')!
// });

const buffer = PlayerSetPositionProto.from({
  x: 1.2,
  y: 2.3,
  dir: 4,
  animate: 5
});

const data = PlayerSetPositionProto.to(buffer);

console.log(data);