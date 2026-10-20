import { Icon } from './icons';
import { toasts } from './store';

export function Toasts() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.value.map((x) => (
        <div key={x.id} class={`toast toast--${x.kind}`} style={{ '--ttl': `${x.ttl}ms` }}>{x.icon && <><Icon name={x.icon} /> </>}{x.text}</div>
      ))}
    </div>
  );
}
