// Discord avatar of a player who joined from the Discord activity (nothing for everyone else).
import { avatars } from './store';

export function Avatar({ id, url, size = 18 }: { id?: string; url?: string; size?: number }) {
  const src = url ?? (id ? avatars.value.get(id) : undefined);
  if (!src) return null;
  return <img class="avatar" src={src} width={size} height={size} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />;
}
