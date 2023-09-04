import { AppReact } from "app";
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