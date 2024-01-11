import { TIMEOUT_RECONNECT } from "@shared/config";

export const ADDRESS_STORE = new Map<string, number>();

export const getTime = (address: string) => {
  return ADDRESS_STORE.get(address) ?? (
    ADDRESS_STORE.set(address, Date.now() - TIMEOUT_RECONNECT),
    ADDRESS_STORE.get(address)!
  );
};

export const setTime = (address: string, value: number) => {
  ADDRESS_STORE.set(address, value);
};