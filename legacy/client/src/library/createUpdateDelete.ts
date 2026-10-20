export const createUpdateDelete = <
  S extends any,
  D extends any
>(
  source: Map<number, S>,
  destination: Map<number, D>,
  onCreate: (inp: S) => D,
  onUpdate: (inp: S, dest: D) => any,
  onDelete: (dest: D) => any
) => {
  for (const [id, dest] of destination) {
    if (!source.has(id)) {
      destination.delete(id);
      onDelete(dest);
    }
  }

  for (const [id, src] of source) {
    let dest = destination.get(id);

    if (!dest) {
      dest = onCreate(src);
      destination.set(id, dest);
    }

    onUpdate(src, dest);
  }
};