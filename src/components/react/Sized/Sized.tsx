import { useFrame } from "hooks/useFrame";
import { useCallback, useRef } from "react";

import styles from "./Sized.module.sass";

import type { FC } from "react";

export type TSizedProps = {
  all?: boolean,
  direction?: 'column' | 'row',
  align?: 'start' | 'center' | 'end';
} & Omit<JSX.IntrinsicElements['div'], 'ref'>;

export const Sized: FC<TSizedProps> = (
  (
    {
      all = false,
      direction = 'column',
      align = 'center',
      className,
      children,
      ...props
    }
  ) => {
    const ref = useRef<HTMLDivElement>(null);
    const content = useRef<HTMLDivElement>(null);

    const resize = useCallback(() => {
      if (!ref.current || !content.current) return;
      const { offsetWidth: width, offsetHeight: height } = content.current;
      ref.current.style.width = (!all && direction === 'column') ? '100%' : width + 'px';
      ref.current.style.height = (!all && direction === 'row') ? '100%' : height + 'px';
    }, [ref]);

    useFrame(resize);

    return (
      <div data-direction={direction} data-align={align} ref={ref} className={`${styles.sized} ${className}`} {...props}>
        <div data-direction={direction} data-align={align} className={styles.precontent}>
          <div ref={content} className={styles.content}>
            {children}
          </div>
        </div>
      </div>
    );
  }
);