export const isEqual = (a: any, b: any) => {
  if (!a !== !b)
    return false;

  if (a === b)
    return true;

  if (typeof a !== typeof b)
    return false;

  if (typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b))
      return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length)
        return false;

      for (let i = 0; i < a.length; i++) {
        if (!isEqual(a[i], b[i]))
          return false;
      }

      return true;
    }

    if (a?.__proto__ !== b?.__proto__)
      return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length)
      return false;

    for (const key of new Set([...keysA, ...keysB]))
      if (!isEqual(a[key], b[key]))
        return false;

    return true;
  }
};