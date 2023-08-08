export const fillMap = (map: Uint8Array, width: number) => {

  for (let i = 0; i < map.length; i++) {
    const x = i % width;
    const y = (i - x) / width;

    if (x & 1 && y & 1)
      map[i] = 1;
  }
};