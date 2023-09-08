import { Application } from "class/Application";
import { Background } from "class/Background";
import { Character } from "class/Character";
import { FocusCamera } from "class/FocusCamera";
import { OUT_FRAME } from "config";
import { useFrame } from "hooks/useFrame";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import styles from "./App.module.sass";

import type { ReactNode, FC } from "react";
const AppCTX = createContext<Application | null>(null);
const CamCTX = createContext<FocusCamera | null>(null);

const { Provider: AppProvider } = AppCTX;
const { Provider: CamProvider } = CamCTX;

export const useApp = () => {
  const app = useContext(AppCTX);
  if (!app) throw new Error('Can\'t used app without context');
  return app;
};

export const useCam = () => {
  const app = useContext(CamCTX);
  if (!app) throw new Error('Can\'t used cam without context');
  return app;
};

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
    const { current } = refCanvas;
    if (!current) return;
    const newCam = new FocusCamera(current);
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

      {cam && (
        <CamProvider value={cam}>
          <div className={styles.app}>
            {children}
          </div>
        </CamProvider>
      )}
    </AppProvider>
  );
};