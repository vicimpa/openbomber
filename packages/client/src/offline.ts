// Offline build (VITE_OFFLINE=1, e.g. a zip for a game portal): there is no game server. The
// online modes stay in the menu but are disabled; nothing connects anywhere (no online count,
// invite links are ignored). Solo games against bots work as usual.
export const OFFLINE = import.meta.env.VITE_OFFLINE === '1';
