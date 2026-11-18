/** Who owns the data on this device. 'local' until the user signs in to a backend. */
export const LOCAL_UID = 'local';
let current = LOCAL_UID;
const subs = new Set<() => void>();

export const getUid = (): string => current;
export function setUid(id: string): void {
  if (id === current) return;
  current = id;
  subs.forEach((f) => f());
}
export function onUidChange(f: () => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}
