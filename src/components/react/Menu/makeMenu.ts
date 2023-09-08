import { createContext, createElement, Fragment, useCallback, useContext, useMemo, useState } from "react";

import type { ReactNode } from "react";


export type TMenu<T extends string> = {
  menu: (key?: T) => void;
  back: () => void;
};

export type TView<T extends string> = (menu: TMenu<T>) => ReactNode;

export type TParam<T extends string> = {
  [key in T]: TView<T>;
};

export type TItemDeco = (node: ReactNode) => ReactNode;
export const CBackMenu = createContext(() => { });

export const makeMenu = <T extends string>(
  params: TParam<T>,
  item: TItemDeco = (e) => e
) => {
  const entries = Object.entries(params) as [T, TView<T>][];
  const main = entries[0][0];

  return ({ show = true }) => {
    const [select, setSelect] = useState(main);
    const back = useCallback(() => setSelect(main), [main]);

    return createElement(
      Fragment,
      null,
      ...entries.map(([id, view]) => {
        return item(
          show && select === id ? (
            createElement(
              () => {
                const toBack = useContext(CBackMenu);
                const menu = (key?: T) => setSelect(key ?? main as T);
                return (
                  createElement(
                    CBackMenu.Provider,
                    { value: back },
                    view({ back: toBack, menu })
                  )
                );
              }
            )
          ) : null
        );
      })
    );
  };
};