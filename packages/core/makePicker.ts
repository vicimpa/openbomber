export const makePicker = <T extends object, K extends keyof T = keyof T>(
  keys: K[]
) => {
  return new Function(
    'obj',
    'return {' +
    keys.map(key => (
      `${key.toString()}: obj['${key.toString()}']`
    )).join(', ') +
    '};'
  ) as ((obj: T) => Pick<T, K>);
};