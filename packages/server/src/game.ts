// Binds the server to the simulation implementation from @ob/game.
// `setGameImpl` lets tests inject a stub; by default the real Simulation / Bot are used.

import { Bot, Simulation, type IBot, type ISimulation, type MatchConfig } from '@ob/game';

export interface GameImpl {
  createSimulation(config: MatchConfig): ISimulation;
  createBot(id: string, sim: ISimulation): IBot;
}

export const realGame: GameImpl = {
  createSimulation: (c) => new Simulation(c),
  createBot: (id) => new Bot(id, 'normal'),
};

let impl: GameImpl = realGame;

export function setGameImpl(i: GameImpl | null) {
  impl = i ?? realGame;
}

export function getGameImpl(): GameImpl {
  return impl;
}
