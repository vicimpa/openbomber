import { Icon } from './icons';
import { gameUncovered, toasts } from './store';

export function Toasts() {
  const game = gameUncovered.value;
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.value.filter((x) => x.system || game).map((x) => (
        <div key={x.id} class={`toast toast--${x.kind}`} style={{ '--ttl': `${x.ttl}ms` }}>{x.icon && <><Icon name={x.icon} /> </>}{x.text}</div>
      ))}
    </div>
  );
}
