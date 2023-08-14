export const makeNumberFilter = (length: number) => {
  const positions: number[] = [];

  return (input: number) => {
    let out = 0;
    positions.push(input);
    positions.splice(0, positions.length - length);

    for (const input of positions)
      out += input;;

    return out / positions.length;
  };
};