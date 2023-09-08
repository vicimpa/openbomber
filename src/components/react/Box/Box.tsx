import { forwardRef } from "react";

import styles from "./Box.module.sass";

export type TBoxProps = {
  width?: number,
  height?: number,
} & Omit<JSX.IntrinsicElements['div'], 'ref'>;

export const Box = forwardRef<HTMLDivElement, TBoxProps>(
  (
    {
      width,
      height,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={`${styles.box} ${className}`}
      style={{
        width,
        height,
        ...style
      }}
      {...props}
    >
      {children}
    </div>
  )
);