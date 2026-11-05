/**
 * The most-recently-used thread list behind the Ctrl+Tab switcher.
 *
 * Entries are scoped thread keys (`environmentId:threadId`), newest first. The
 * list is per client and lives in local storage; it is not synced.
 */

export const RECENT_THREADS_STORAGE_KEY = "t3code:fork:recent-threads:v1";
const RECENT_THREADS_LIST_COLLAPSED_STORAGE_KEY = "t3code:fork:recent-threads:list-collapsed:v1";
export const RECENT_THREADS_CAP = 50;

export interface RecentThreadCandidate {
  readonly archivedAt: string | null;
  readonly deletedAt: string | null;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Moves `key` to the front, drops duplicates, and keeps at most `cap` entries. */
export function touchRecentThread(
  keys: readonly string[],
  key: string,
  cap = RECENT_THREADS_CAP,
): readonly string[] {
  if (keys[0] === key && keys.length <= cap && new Set(keys).size === keys.length) return keys;
  const next = [key];
  for (const existing of keys) {
    if (next.length >= cap) break;
    if (existing !== key && !next.includes(existing)) next.push(existing);
  }
  return next;
}

/** Drops threads that were deleted or archived. Unknown threads stay: their environment may not have loaded yet. */
export function pruneRecentThreads(
  keys: readonly string[],
  lookup: (key: string) => RecentThreadCandidate | null,
): readonly string[] {
  const kept = keys.filter((key) => {
    const thread = lookup(key);
    return thread === null || (thread.archivedAt === null && thread.deletedAt === null);
  });
  return kept.length === keys.length ? keys : kept;
}

/**
 * The switcher's rows: recent threads that exist and are neither deleted nor
 * archived, with the open thread first.
 */
export function resolveRecentThreadList(
  keys: readonly string[],
  currentKey: string | null,
  lookup: (key: string) => RecentThreadCandidate | null,
): readonly string[] {
  const ordered = currentKey === null ? keys : touchRecentThread(keys, currentKey, Infinity);
  return ordered.filter((key) => {
    const thread = lookup(key);
    return thread !== null && thread.archivedAt === null && thread.deletedAt === null;
  });
}

export function readRecentThreadKeys(storage: StorageLike | null): readonly string[] {
  try {
    const raw = storage?.getItem(RECENT_THREADS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const keys = parsed.filter(
      (entry): entry is string => typeof entry === "string" && entry.includes(":"),
    );
    return [...new Set(keys)].slice(0, RECENT_THREADS_CAP);
  } catch {
    return [];
  }
}

export function writeRecentThreadKeys(storage: StorageLike | null, keys: readonly string[]): void {
  try {
    storage?.setItem(RECENT_THREADS_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Storage can be full or disabled; the list then lives for this session only.
  }
}

export function readListCollapsed(storage: StorageLike | null): boolean {
  try {
    return storage?.getItem(RECENT_THREADS_LIST_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeListCollapsed(storage: StorageLike | null, collapsed: boolean): void {
  try {
    storage?.setItem(RECENT_THREADS_LIST_COLLAPSED_STORAGE_KEY, collapsed ? "true" : "false");
  } catch {
    // Not remembered when storage is unavailable.
  }
}

export function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
