export type TStylesVariable = {
  [key: string]: string | number | undefined | null;
};
export const stylesVariable = <T extends TStylesVariable>(obj: T) => {
  let outputString = '';

  for (let key in obj) {
    let val = obj[key];

    if (val === undefined || val === null)
      continue;

    outputString += `--${key}:${val};`;
  }

  return outputString;
};

