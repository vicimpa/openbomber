import equal from "fast-deep-equal";

import { isEqualBuffer } from "./isEqualBuffer";

export const makeEffect = <T>() => {
  let previewValue: T | null = null;

  return (newValue: T, callback: (value: T, previewValue: T | null) => any) => {
    try {
      if (newValue instanceof ArrayBuffer && previewValue instanceof ArrayBuffer) {
        if (isEqualBuffer(previewValue, newValue))
          return;
      } else {
        if (equal(previewValue, newValue))
          return;
      }
    } catch (e) {

      callback(newValue, previewValue);
      previewValue = newValue;
      return;
    }

    callback(newValue, previewValue);
    previewValue = newValue;
  };
};