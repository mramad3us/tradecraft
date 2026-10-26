// TRADECRAFT sim: the bus. The sim reports facts on it (a roll, a section built, an autosave due);
// whoever listens (the renderer, the UI, a test) decides what to do with them. The sim never waits
// on a listener and never reads anything back.
export function createBus() {
  const subs = new Map();
  return {
    on(type, fn) { if (!subs.has(type)) subs.set(type, new Set()); subs.get(type).add(fn); return () => subs.get(type).delete(fn); },
    emit(type, data) { for (const fn of subs.get(type) ?? []) fn(data); for (const fn of subs.get('*') ?? []) fn(type, data); },
  };
}
