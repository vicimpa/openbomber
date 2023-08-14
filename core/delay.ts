export const delay = (n: number) => (
  new Promise<void>(r => {
    setTimeout(r, n);
  })
);