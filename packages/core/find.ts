export function find<T extends object>(collect: Set<T> | T[], condition: Partial<T> | ((v: T, i: number) => boolean)) {
  if (typeof condition === 'object') {
    const data = condition;

    condition = (object) => {
      for (const key in data) {
        if (data[key] !== object[key])
          return false;
      }

      return true;
    };
  }

  let i = 0;

  for (const f of collect) {
    if (condition(f, i++))
      return f;
  }

  return null;
}