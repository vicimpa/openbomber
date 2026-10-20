export function* range(from = 0, to = 0, step = 1) {
  if (from > to) [from, to] = [to, from];

  for (let i = from; i < to; i += step)
    yield i;
}

export function arange(from?: number, to?: number, step?: number) {
  return [...range(from, to, step)];
}