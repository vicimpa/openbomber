import { EDir } from "@ob/shared/types";
import { Entity } from "./Entity";

export class Npc extends Entity {
  name = 'Монстр';

  dir: EDir = EDir.TOP;

  update(): void { }
}