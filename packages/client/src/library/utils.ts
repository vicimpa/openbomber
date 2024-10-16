export function toObject<T>(input: Partial<T>, output: T) {
  if (typeof input != 'object')
    return;

  for (let key in input) {
    if (typeof input[key] == 'object')
      toObject((input as any)[key], output[key]);
    else
      (output as any)[key] = input[key];
  }
}

interface CreateDOMProps {
  appendTo: HTMLElement;
}

export function createDOM<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Partial<HTMLElementTagNameMap[K] & CreateDOMProps> | null, ...childs: HTMLElement[]) {
  const elem = document.createElement<K>(tag);
  const { appendTo, ...p } = props ?? {};

  toObject(p as any, elem);

  for (const child of childs)
    elem.appendChild(child);

  if (appendTo)
    appendTo.appendChild(elem);

  return elem;
}