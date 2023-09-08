import "library/gamepads";

import { AppReact } from "app";
import { createRoot } from "react-dom/client";

import AppSvelte from "./app.svelte";

new AppSvelte({
  target: document.getElementById('root')!
});

// createRoot(document.getElementById('root')!)
//   .render(<AppReact />);

addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
});