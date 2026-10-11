// Only unfinished edits live here. Saved cards and observations are read from PostgreSQL.
const memory = new Map<string, string | null>();
const listeners = new Set<() => void>();
export function readNoteDraft(key: string) {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}
export function writeNoteDraft(key: string, value: unknown): boolean {
  const raw = value === null ? null : JSON.stringify(value);
  memory.set(key, raw);
  let saved = true;
  try {
    if (raw === null) localStorage.removeItem(key);
    else localStorage.setItem(key, raw);
  } catch {
    saved = false;
  }
  listeners.forEach((listener) => listener());
  return saved;
}
export function subscribeNotes(listener: () => void) {
  listeners.add(listener);
  const storage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith("practice:note:")) {
      if (event.key === null) memory.clear();
      else memory.delete(event.key);
      listener();
    }
  };
  window.addEventListener("storage", storage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", storage);
  };
}
export function parseNoteDraft<T>(
  raw: string | null,
  parse: (value: unknown) => T,
): T | null {
  try {
    return raw ? parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
