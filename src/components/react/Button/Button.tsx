import { forwardRef } from "react";

import styles from "./Button.module.sass";

export type TButtonProps = {
  color?: 'primary' | 'secondary' | 'info' | 'warning' | 'error';
} & Omit<JSX.IntrinsicElements['button'], 'ref'>;

export const Button = forwardRef<HTMLButtonElement, TButtonProps>(
  (
    {
      color = 'primary',
      children,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <button data-color={color} ref={ref} className={`${styles.button} ${className}`} {...props}>
        {children}
      </button>
    );
  }
);