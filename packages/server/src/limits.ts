// Per-IP abuse limits, checked in BattleRoom.onAuth before a seat is reserved.
// The IP comes from Colyseus' auth context (x-real-ip / x-forwarded-for / peer address), so in
// production the server must sit behind the nginx proxy that sets X-Real-IP; exposed directly,
// those headers could be forged.

import { TokenBucket } from './util.ts';

export const limits = {
  /** Simultaneous connections (players + spectators, all rooms) from one IP. */
  clientsPerIp: Number(process.env.MAX_CLIENTS_PER_IP) || 6,
  /** Rooms alive at once on this server (the main room included). */
  rooms: Number(process.env.MAX_ROOMS) || 300,
  /** Matchmaking requests per IP: burst, then per second. */
  requestBurst: 10,
  requestsPerSecond: 1,
  /** Room creations per IP: burst, then per second (one per 20 s). */
  createBurst: 3,
  createsPerSecond: 1 / 20,
};

interface IpState {
  clients: number;
  /** Any matchmaking request (join / create / joinById). */
  requests: TokenBucket;
  /** Room creations: a few at once, then one per 20 s. */
  creates: TokenBucket;
  idleSince: number;
}

const ips = new Map<string, IpState>();
let rooms = 0;

function stateFor(ip: string): IpState {
  let s = ips.get(ip);
  if (!s) {
    s = {
      clients: 0,
      requests: new TokenBucket(limits.requestBurst, limits.requestsPerSecond),
      creates: new TokenBucket(limits.createBurst, limits.createsPerSecond),
      idleSince: Date.now(),
    };
    ips.set(ip, s);
  }
  return s;
}

export type Denied = 'rate' | 'clients' | 'rooms';

/** Matchmaking gate. Returns why the request is refused, or null. */
export function admit(ip: string, creating: boolean): Denied | null {
  const s = stateFor(ip);
  if (!s.requests.take()) return 'rate';
  if (s.clients >= limits.clientsPerIp) return 'clients';
  if (creating) {
    if (rooms >= limits.rooms) return 'rooms';
    if (!s.creates.take()) return 'rate';
  }
  return null;
}

export function clientJoined(ip: string) {
  stateFor(ip).clients++;
}

export function clientLeft(ip: string) {
  const s = ips.get(ip);
  if (!s) return;
  s.clients = Math.max(0, s.clients - 1);
  if (s.clients === 0) s.idleSince = Date.now();
}

export function roomCreated() { rooms++; }
export function roomDisposed() { rooms = Math.max(0, rooms - 1); }

/** Forget idle IPs so the table can't grow without bound. */
export function sweepIps(maxIdleMs = 10 * 60_000) {
  const now = Date.now();
  for (const [ip, s] of ips) if (s.clients === 0 && s.idleSince && now - s.idleSince > maxIdleMs) ips.delete(ip);
}

/** Tests. */
export function resetLimits() {
  ips.clear();
  rooms = 0;
}
