import { App } from "components/react/App";
import { Panel } from "components/react/Panel";
import { createRoot } from "react-dom/client";

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