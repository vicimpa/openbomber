import { Vec2 } from "../../core/Vec2";
import { Game } from "./Game";

export class Entity extends Vec2 {
  constructor(
    public game: Game,
    x: number,
    y: number
  ) {
    super(x, y);
  }

  update() { }
}