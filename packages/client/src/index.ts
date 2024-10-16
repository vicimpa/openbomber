import AppSvelte from "./app.svelte";

new AppSvelte({
  target: document.getElementById('root')!
});

addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
});