export type TIDObject = {
  id: number;
};

export const updateIdMap = <T extends TIDObject>(
  array: T[],
  map: Map<number, T>
) => {
  const ids = new Set<number>(map.keys());

  for (let i = 0; i < array.length; i++) {
    const { id } = array[i];
    ids.delete(id);

    let obj = map.get(id);

    if (!obj) {
      obj = array[i];
      map.set(id, obj);
    }

    Object.assign(obj, array[i]);
  }

  for (const id of ids) {
    map.delete(id);
  }
};