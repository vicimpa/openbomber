import equal from "fast-deep-equal";

import { isEqualBuffer } from "./isEqualBuffer";

export const makeEffect = <T>() => {
  let previewValue: T | null = null;

  return (newValue: T, callback: (value: T) => any) => {
    if (newValue instanceof ArrayBuffer && previewValue instanceof ArrayBuffer) {
      if (isEqualBuffer(previewValue, newValue))
        return;
    } else {
      if (equal(previewValue, newValue))
        return;
    }

    previewValue = newValue;
    callback(newValue);
  };
};