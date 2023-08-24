import { Vec2 } from "@/Vec2";
import { App } from "components/react/App";
import { Panel } from "components/react/Panel";
import { createRoot } from "react-dom/client";

const a = new Vec2(1, 2);
const b = new Vec2(2, 3);


createRoot(document.getElementById('root')!)
  .render(
    <App>
      <Panel>
        <button>Кнопочка 1</button>
        <button>Кнопочка 2</button>
        <button>Кнопочка 3</button>
      </Panel>
    </App>
  );