import { createElement, forwardRef } from "react";

import styles from "./Typo.module.sass";

import type { ReactNode } from "react";

export type TElem = never
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'p'
  | 'span'
  | 'b'
  | 'i'
  | 'tt'
  | 'cite'
  | 'em'
  | 'small'
  | 'pre';

export type TAlign = never
  | 'left'
  | 'right'
  | 'center';

export type TColor = never
  | 'primary'
  | 'secondary'
  | 'info'
  | 'warning'
  | 'error';

export type TTypoProps<T extends TElem> = {
  elem?: T;
  color?: TColor,
  align?: TAlign;
} & (
    T extends keyof JSX.IntrinsicElements ? JSX.IntrinsicElements[T] : never
  );

export const Typo = forwardRef<HTMLElement, TTypoProps<'h1'>>(
  (
    {
      elem = 'h1',
      align = 'left',
      color = 'primary',
      className,
      children,
      ...props
    },
    ref
  ) => {
    return createElement(
      elem,
      {
        ref,
        className: `${styles.typo} ${className}`,
        ['data-color']: color,
        ['data-align']: align,
        ...props
      },
      children
    );
  }
) as <T extends TElem = 'h1'>(props: TTypoProps<T>) => ReactNode;

<Typo />;