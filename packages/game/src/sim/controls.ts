// Read-only control queries shared by the simulation and the HUD.
import { Ability, BombMotion, Curse, DIR_VEC, Phase, Tile, type PlayerState, type WorldState } from '../contract/types';
import { bombAtTile, bombIsGrounded, tileAt } from './world';

export function punchTarget(w: WorldState, p: PlayerState) {
  const [dx, dy] = DIR_VEC[p.dir];
  const b = bombAtTile(w, Math.round(p.x) + dx, Math.round(p.y) + dy);
  return b?.motion === BombMotion.Idle && (b.x - p.x) ** 2 + (b.y - p.y) ** 2 <= 1.05 ** 2 ? b : undefined;
}

export function grabTarget(w: WorldState, p: PlayerState) {
  const b = bombAtTile(w, Math.round(p.x), Math.round(p.y));
  return b?.motion === BombMotion.Idle ? b : punchTarget(w, p);
}

export function remoteTarget(w: WorldState, p: PlayerState) {
  for (const b of w.bombs.values()) {
    if (b.owner === p.id && b.fuse < 0 && bombIsGrounded(b)) return b;
  }
  return undefined;
}

/** Same destinations for the Teleport button and its availability hint. */
export function teleportTiles(w: WorldState, p: PlayerState): number[] {
  const busy = new Set<number>();
  for (const b of w.bombs.values()) {
    if (bombIsGrounded(b)) busy.add(Math.round(b.y) * w.width + Math.round(b.x));
  }
  for (const f of w.flames.values()) busy.add(f.y * w.width + f.x);
  for (const f of w.falling) busy.add(f.y * w.width + f.x);
  const fromX = Math.round(p.x), fromY = Math.round(p.y);
  const spots: number[] = [];
  for (let i = 0; i < w.tiles.length; i++) {
    if (w.tiles[i] !== Tile.Floor || busy.has(i)) continue;
    const x = i % w.width, y = (i / w.width) | 0;
    if (x === fromX && y === fromY) continue;
    let near = false;
    for (const o of w.players.values()) {
      if (o !== p && o.alive && Math.abs(o.x - x) < 1.5 && Math.abs(o.y - y) < 1.5) { near = true; break; }
    }
    if (!near) spots.push(i);
  }
  return spots;
}

export type ControlKind = 'bomb' | 'lineBomb' | 'grab' | 'throw' | 'punch' | 'remote' | 'teleport';
export type ControlReason = 'ready' | 'countdown' | 'roundOver' | 'respawning' | 'stun' | 'carrying' | 'curse'
  | 'lastPlayer' | 'bombLimit' | 'blocked' | 'noAbility' | 'noBombNearby' | 'noRemoteBomb' | 'noCharges' | 'noDestination';
export interface ControlHint {
  kind: ControlKind;
  reason: ControlReason;
  count?: number;
}
export interface ControlHints { bomb: ControlHint; action: ControlHint; punch: ControlHint; detonate: ControlHint; teleport: ControlHint }

export function controlHints(w: WorldState, p: PlayerState): ControlHints {
  const at = bombAtTile(w, Math.round(p.x), Math.round(p.y));
  let owned = 0, alive = 0;
  for (const b of w.bombs.values()) if (b.owner === p.id) owned++;
  for (const q of w.players.values()) if (q.alive && q.inRound) alive++;
  const free = Math.max(0, p.bombs - owned);
  const line = !!(p.abilities & Ability.LineBomb) && at?.owner === p.id;
  const [dx, dy] = DIR_VEC[p.dir];
  const x = Math.round(p.x) + (line ? dx : 0), y = Math.round(p.y) + (line ? dy : 0);
  const occupied = tileAt(w, x, y) !== Tile.Floor || !!bombAtTile(w, x, y)
    || [...w.pickups.values()].some((k) => k.x === x && k.y === y);
  const bomb: ControlHint = { kind: line ? 'lineBomb' : 'bomb', count: free,
    reason: p.carrying >= 0 ? 'carrying' : p.curse === Curse.Constipation ? 'curse'
      : w.players.size > 1 && alive < 2 ? 'lastPlayer' : free === 0 ? 'bombLimit' : occupied ? 'blocked' : 'ready' };

  const action: ControlHint = p.carrying >= 0 ? { kind: 'throw', reason: 'ready' }
    : { kind: 'grab', reason: !(p.abilities & Ability.Glove) ? 'noAbility' : grabTarget(w, p) ? 'ready' : 'noBombNearby' };
  const punch: ControlHint = { kind: 'punch', reason: p.carrying >= 0 ? 'carrying'
    : !(p.abilities & Ability.Punch) ? 'noAbility' : punchTarget(w, p) ? 'ready' : 'noBombNearby' };
  let waiting = 0;
  for (const b of w.bombs.values()) if (b.owner === p.id && b.fuse < 0 && bombIsGrounded(b)) waiting++;
  const detonate: ControlHint = { kind: 'remote', count: waiting,
    reason: !(p.abilities & Ability.Remote) ? 'noAbility' : waiting > 0 ? 'ready' : 'noRemoteBomb' };
  const teleport: ControlHint = { kind: 'teleport', count: p.teleports,
    reason: p.teleports <= 0 ? 'noCharges' : teleportTiles(w, p).length === 0 ? 'noDestination' : 'ready' };
  const blocked: ControlReason | undefined = !p.alive || !p.inRound ? 'respawning'
    : w.phase === Phase.Countdown ? 'countdown'
      : w.phase !== Phase.Playing && w.phase !== Phase.SuddenDeath ? 'roundOver'
        : p.effects.stun > 0 ? 'stun' : undefined;
  if (blocked) for (const hint of [bomb, action, punch, detonate, teleport]) hint.reason = blocked;
  return { bomb, action, punch, detonate, teleport };
}
