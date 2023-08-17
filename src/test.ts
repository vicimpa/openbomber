import { Proto } from "@/core/Proto";

// {id: number, x: number, y: number, name: string}

const user = new Proto({
  id: 'uint8',
  x: 'float32',
  y: 'float32',
  name: 'string'
});

const userJson = JSON.stringify({
  id: 12,
  x: 12.5,
  y: 13.6,
  name: 'Roman'
});

const buff = user.from({
  id: 12,
  x: 12.5,
  y: 13.6,
  name: 'Roman'
});