import type { TInfo } from "types";
import type { Achivment } from "../../server/class/Achivment";
import type { Bomb } from "../../server/class/Bomb";
import type { Explode } from "../../server/class/Explode";
import type { Player } from "../../server/class/Player";

export class GameMap {
  #subs = new Set<(m: GameMap) => any>();

  #map!: Uint8Array;
  #bombs!: TInfo<Bomb>[];
  #achivments!: TInfo<Achivment>[];
  #explodes!: TInfo<Explode>[];
  #players!: TInfo<Player>[];

  get map() { return this.#map; }
  get bombs() { return this.#bombs; }
  get achivments() { return this.#achivments; }
  get explodes() { return this.#explodes; }
  get players() { return this.#players; }

  set map(v) { this.#map = v; this.update(); }
  set bombs(v) { this.#bombs = v; this.update(); }
  set achivments(v) { this.#achivments = v; this.update(); }
  set explodes(v) { this.#explodes = v; this.update(); }
  set players(v) { this.#players = v; this.update(); }

  constructor(
    public width: number,
    public height: number
  ) {
    this.reset();
  }

  reset() {
    this.#map = new Uint8Array(this.width * this.height);
    this.#bombs = [];
    this.#achivments = [];
    this.#explodes = [];
    this.#players = [];
  }

  update() {
    for (const sub of this.#subs) {
      sub(this);
    }
  }

  subscribe(run: (gameMap: GameMap) => any) {
    this.#subs.add(run);

    return () => {
      this.#subs.delete(run);
    };
  }
}