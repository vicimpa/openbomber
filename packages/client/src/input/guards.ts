// Stop the browser from zooming, scrolling, pulling-to-refresh and opening long-press menus
// while the game screen is up. Returns a disposer.
export function installPlayGuards(root: HTMLElement): () => void {
  const prevent = (e: Event) => { if (e.cancelable) e.preventDefault(); };
  const onTouchMove = (e: TouchEvent) => {
    // Let scrollable HUD panels (chat history, scoreboard) scroll.
    const t = e.target as HTMLElement | null;
    if (t?.closest?.('[data-scrollable]')) return;
    prevent(e);
  };
  const onWheel = (e: WheelEvent) => { if (e.ctrlKey) prevent(e); }; // trackpad pinch
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) prevent(e);
  };
  let lastTouchEnd = 0;
  const onTouchEnd = (e: TouchEvent) => {
    const now = e.timeStamp;
    const t = e.target as HTMLElement | null;
    if (now - lastTouchEnd < 300 && !t?.closest?.('input, textarea, button, a')) prevent(e); // double-tap zoom
    lastTouchEnd = now;
  };

  const opts = { passive: false } as const;
  root.addEventListener('touchmove', onTouchMove, opts);
  root.addEventListener('touchend', onTouchEnd, opts);
  root.addEventListener('contextmenu', prevent);
  root.addEventListener('selectstart', prevent);
  root.addEventListener('dragstart', prevent);
  root.addEventListener('wheel', onWheel, opts);
  document.addEventListener('gesturestart', prevent, opts as AddEventListenerOptions);
  document.addEventListener('gesturechange', prevent, opts as AddEventListenerOptions);
  window.addEventListener('keydown', onKey);
  document.documentElement.classList.add('is-playing');

  return () => {
    root.removeEventListener('touchmove', onTouchMove);
    root.removeEventListener('touchend', onTouchEnd);
    root.removeEventListener('contextmenu', prevent);
    root.removeEventListener('selectstart', prevent);
    root.removeEventListener('dragstart', prevent);
    root.removeEventListener('wheel', onWheel);
    document.removeEventListener('gesturestart', prevent);
    document.removeEventListener('gesturechange', prevent);
    window.removeEventListener('keydown', onKey);
    document.documentElement.classList.remove('is-playing');
  };
}
