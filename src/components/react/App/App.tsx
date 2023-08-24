import { createContext, useContext, useMemo, useEffect, useRef, useState } from "react";
import type { ReactNode, FC } from "react";
import { Application } from "class/Application";
import { FocusCamera } from "class/FocusCamera";
import { Background } from "class/Background";

import styles from "./App.module.sass";
import { useFrame } from "hooks/useFrame";

const AppCTX = createContext<Application | null>(null);
const CamCTX = createContext<FocusCamera | null>(null);

const { Provider: AppProvider } = AppCTX;
const { Provider: CamProvider } = CamCTX;

export const useApp = () => (
  useContext(AppCTX)
);

export type TAppProps = {
  children?: ReactNode;
};

export const App: FC<TAppProps> = ({ children }) => {
  const refCanvas = useRef<HTMLCanvasElement>(null);
  const [cam, setCam] = useState<FocusCamera | null>(null);

  const app = useMemo(() => (
    new Application(false)
  ), []);

  useEffect(() => {
    if (!refCanvas.current) return;
    const newCam = new FocusCamera(refCanvas.current);
    const back = new Background(128, 128);

    setCam(newCam);

    app.cameras.add(newCam);
    back.appendTo(app);

    return () => {
      newCam.delete();
      back.delete();
    };
  }, []);

  useFrame((dtime, time) => {
    app.loop(dtime, time);
  });

  return (
    <AppProvider value={app}>
      <canvas
        ref={refCanvas}
        className={styles.canvas}
      />


      <div className={styles.app}>
        {cam && (
          <CamProvider value={cam}>
            {children}
          </CamProvider>
        )}
      </div>
    </AppProvider>
  );
};