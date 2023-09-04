import { AppReact } from "app";
import append from "append.html?raw";
import { createDOM } from "library/utils";
import { createRoot } from "react-dom/client";

import AppSvelte from "./app.svelte";

if (location.hash !== '#new') {
  new AppSvelte({
    target: document.getElementById('root')!
  });
} else {
  createRoot(document.getElementById('root')!)
    .render(<AppReact />);
}

addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
});

if (location.protocol == 'https:') {
  const appendTo = document.head;

  createDOM('link', { rel: 'manifest', href: './manifest.json', appendTo });
  createDOM('link', { rel: 'shortcut icon', href: '/images/favicon.png', type: 'image/png', appendTo });

  addEventListener("load", () => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistration('./service.js')
        .then(e => e ? e : navigator.serviceWorker
          .register("./service.js", {
            scope: location.pathname
          }))
        .catch(() => { });
    }

    window.matchMedia(
      '(display-mode: standalone)'
    ).matches;
  });

  const elem = document.createElement('div');
  elem.innerHTML = append;

  for (const child of elem.childNodes)
    document.body.appendChild(child);
}