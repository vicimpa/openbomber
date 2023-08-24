import { createContext, useContext, useMemo, useEffect, useRef, useState } from "react";
import type { ReactNode, FC } from "react";
import { Application } from "class/Application";
import { FocusCamera } from "class/FocusCamera";
import { Background } from "class/Background";

import styles from "./App.module.sass";
import { useFrame } from "hooks/useFrame";
import { Entity } from "class/Entity";
import type { Camera } from "class/Camera";
import { point } from "@/point";
import { isColide } from "@/isColide";

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

class Rect extends Entity {
  #size = point();

  width = 16;
  height = 16;

  get size() { return this.#size.set(this.width, this.height); }

  color = '#fff';

  render(camera: Camera): void {
    const { ctx } = camera;

    ctx.fillStyle = this.color;
    ctx.fillRect(0, 0, this.width, this.height);
  }
}

export const App: FC<TAppProps> = ({ children }) => {
  const refCanvas = useRef<HTMLCanvasElement>(null);
  const [cam, setCam] = useState<FocusCamera | null>(null);

  const bound = useMemo(() => (
    new Rect()
  ), []);

  const colide = useMemo(() => (
    new Rect()
  ), []);

  const app = useMemo(() => (
    new Application(false)
  ), []);

  useEffect(() => {
    const { current } = refCanvas;
    if (!current) return;
    const newCam = new FocusCamera(current);
    const back = new Background(128, 128);
    const vec = point();
    const mouse = point();

    current.onmousemove = ({ x, y }) => {
      mouse.set(x, y).div(newCam.s).minus(colide.size.cdiv(2));

      colide.set(
        vec.set(newCam.width, newCam.height).div(newCam.s).div(-2).plus(mouse)
      );
    };

    setCam(newCam);

    colide.width = 10;

    bound.appendTo(newCam);
    colide.appendTo(newCam);

    app.cameras.add(newCam);
    back.appendTo(app);

    return () => {
      newCam.delete();
      back.delete();
    };
  }, []);

  useFrame((dtime, time) => {
    colide.color = isColide(bound, colide, bound.size, colide.size) ? '#f00' : '#999';
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