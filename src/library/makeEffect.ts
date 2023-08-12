import equal from "fast-deep-equal";

export const makeEffect = <T>() => {
  let previewValue: T | null = null;

  return (newValue: T, callback: (value: T) => any) => {
    if (equal(previewValue, newValue))
      return;

    previewValue = newValue;
    callback(newValue);
  };
};