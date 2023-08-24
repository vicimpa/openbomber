import type { FC, ReactNode } from "react";

import styles from "./Panel.module.sass";

export type TPanelProps = {
  children?: ReactNode;
};

export const Panel: FC<TPanelProps> = ({ children }) => {

  return (
    <div className={styles.panel}>
      {children}
    </div>
  );
};