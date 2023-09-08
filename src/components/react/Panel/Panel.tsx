import styles from "./Panel.module.sass";

import type { FC } from "react";
export type TPanelProps = {
  padding?: string;
} & Omit<JSX.IntrinsicElements['div'], 'ref'>;

export const Panel: FC<TPanelProps> = ({ children, padding, className, ...props }) => {
  return (
    <div className={`${styles.panel} ${className}`} {...props}>
      <div style={{ padding }} className={styles.content}>
        {children}
      </div>
    </div>
  );
};