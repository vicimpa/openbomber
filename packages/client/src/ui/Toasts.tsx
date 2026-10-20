import { toasts } from './store';

export function Toasts() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.value.map((x) => (
        <div key={x.id} class={`toast toast--${x.kind}`} style={{ '--ttl': `${x.ttl}ms` }}>{x.text}</div>
      ))}
    </div>
  );
}
