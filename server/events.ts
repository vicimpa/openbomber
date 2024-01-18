import { Events } from "../core/Events";

export interface IServerEvents {
  changePlayes: {
    type: 'in' | 'out';
    nickname: string;
    totalCount: number;
  };
}

export const events = new Events<IServerEvents>();