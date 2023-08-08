import { Game } from "./Game";

export class Entity {
  constructor(
    public game: Game,
    public x: number,
    public y: number
  ) { }

  update() { }
}