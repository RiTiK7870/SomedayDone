// Delayed deletion with undo. A deleted item disappears straight away, but it only
// reaches the database after a short window. Undo cancels it. Leaving the app commits
// anything still waiting, so nothing is left half-deleted.
export const UNDO_WINDOW_MS = 5000;

interface Pending {
  id: string;
  key: string; // "goal:<id>" or "step:<id>"
  label: string;
  commit: () => Promise<void>;
  timer: ReturnType<typeof setTimeout>;
}

export interface UndoItem {
  id: string;
  label: string;
}

let pending: Pending[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeUndo(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// True while an item is hidden and waiting to be deleted.
export function isPendingDeletion(key: string): boolean {
  return pending.some((p) => p.key === key);
}

// The most recent pending deletion, for the undo bar.
export function currentUndo(): UndoItem | null {
  const last = pending[pending.length - 1];
  return last ? { id: last.id, label: last.label } : null;
}

export function scheduleDeletion(
  key: string,
  label: string,
  commit: () => Promise<void>,
): void {
  if (isPendingDeletion(key)) return;
  const id = `${key}:${Date.now()}`;
  const timer = setTimeout(() => {
    void finish(id);
  }, UNDO_WINDOW_MS);
  pending.push({ id, key, label, commit, timer });
  emit();
}

export function undoDeletion(id: string): void {
  const item = pending.find((p) => p.id === id);
  if (!item) return;
  clearTimeout(item.timer);
  pending = pending.filter((p) => p.id !== id);
  emit();
}

async function finish(id: string): Promise<void> {
  const item = pending.find((p) => p.id === id);
  if (!item) return;
  try {
    await item.commit();
  } catch (e) {
    console.error("Deletion failed:", e);
  } finally {
    // Leave the hidden list only after the commit, so the item never flickers back.
    pending = pending.filter((p) => p.id !== id);
    emit();
  }
}

// Commits everything still waiting. Called when the app leaves the foreground.
export function flushDeletions(): void {
  const items = [...pending];
  items.forEach((p) => clearTimeout(p.timer));
  items.forEach((p) => {
    void finish(p.id);
  });
}
