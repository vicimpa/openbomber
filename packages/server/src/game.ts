// Binds the server to the simulation implementation from @ob/game.
// `setGameImpl` lets tests inject a stub; by default the real Simulation / Bot are used.

import { Bot, Simulation, type BotDifficultyName, type IBot, type ISimulation, type MatchConfig } from '@ob/game';

export interface GameImpl {
  createSimulation(config: MatchConfig): ISimulation;
  createBot(id: string, sim: ISimulation, difficulty?: BotDifficultyName): IBot;
}

export const realGame: GameImpl = {
  createSimulation: (c) => new Simulation(c),
  createBot: (id, _sim, difficulty = 'normal') => new Bot(id, difficulty),
};

let impl: GameImpl = realGame;

export function setGameImpl(i: GameImpl | null) {
  impl = i ?? realGame;
}

export function getGameImpl(): GameImpl {
  return impl;
}
