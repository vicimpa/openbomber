import { createDOM } from "library/utils";
import App from "./app.svelte";

new App({
  target: document.getElementById('app')!
});

addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
});

if (location.protocol == 'https:') {
  const appendTo = document.head;

  createDOM('link', { rel: 'manifest', href: './manifest.json', appendTo });
  createDOM('link', { rel: 'shortcut icon', href: 'favicon.png', type: 'image/png', appendTo });

  addEventListener("load", () => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistration('./service.js')
        .then(e => e ? e : navigator.serviceWorker
          .register("./servise.js", {
            scope: location.pathname
          }))
        .catch(() => { });
    }

    window.matchMedia(
      '(display-mode: standalone)'
    ).matches;
  });
}