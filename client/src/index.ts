import { writable } from "svelte/store";

import App from "./app.svelte";

new App({
  target: document.getElementById('app')!
});
