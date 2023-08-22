import App from "./app.svelte";

new App({
  target: document.getElementById('app')!
});

addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
});