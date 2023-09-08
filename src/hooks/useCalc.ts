import { useState } from "react";

import { useFrame } from "./useFrame";

export const useCalc = (
  <T>(calc: (dtime: number, time: number) => T): T => {
    const [value, setValue] = useState<T>();

    useFrame((dtime, time) => {
      const newValue = calc(dtime, time);

      if (value !== newValue)
        setValue(newValue);
    });

    return value!;
  }
);