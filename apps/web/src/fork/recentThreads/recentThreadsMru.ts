/**
 * The most-recently-used thread list behind the Ctrl+Tab switcher.
 *
 * Entries are scoped thread keys or draft keys, newest first, each
 * with the last time it was the open thread. The list lives in memory only, so
 * it starts empty with every app start or reload.
 */

import type { DraftId } from "../../composerDraftStore";

const RECENT_THREADS_LIST_COLLAPSED_STORAGE_KEY = "t3code:fork:recent-threads:list-collapsed:v1";
const RECENT_THREADS_TIMEOUT_STORAGE_KEY = "t3code:fork:recent-threads:timeout-minutes:v1";
export const RECENT_THREADS_CAP = 50;
export const DEFAULT_RECENT_THREADS_TIMEOUT_MINUTES = 30;
/** 0 keeps threads until they fall off the cap. */
export const RECENT_THREADS_TIMEOUT_OPTIONS = [0, 15, 30, 60, 120] as const;

export interface RecentThreadEntry {
  readonly key: string;
  /** Epoch ms when this thread was last the open thread. */
  readonly at: number;
}

export interface RecentThreadCandidate {
  readonly archivedAt: string | null;
  readonly deletedAt: string | null;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

// Scoped thread keys cannot start with a colon.
const DRAFT_KEY_PREFIX = ":draft:";

export function recentDraftKey(draftId: DraftId): string {
  return `${DRAFT_KEY_PREFIX}${draftId}`;
}

export function parseRecentDraftKey(key: string): DraftId | null {
  return key.startsWith(DRAFT_KEY_PREFIX) ? (key.slice(DRAFT_KEY_PREFIX.length) as DraftId) : null;
}

/** Replacements keep the source entry's slot and timestamp, even if the destination was visited. */
export function reconcileRecentThreadEntries(
  entries: readonly RecentThreadEntry[],
  resolveKey: (key: string) => string | null,
): readonly RecentThreadEntry[] {
  const resolved = entries.map((entry) => ({ entry, key: resolveKey(entry.key) }));
  if (resolved.every(({ entry, key }) => entry.key === key)) return entries;

  const replacements = new Map<string, RecentThreadEntry>();
  for (const { entry, key } of resolved) {
    if (key !== null && key !== entry.key && !replacements.has(key)) replacements.set(key, entry);
  }
  return resolved.flatMap(({ entry, key }) => {
    if (key === null) return [];
    const source = replacements.get(key);
    if (source !== undefined) return source === entry ? [{ ...entry, key }] : [];
    return [entry];
  });
}

/**
 * Records a route change from `previousKey` to `nextKey` (either may be null for
 * non-thread routes): the thread left is stamped `now`, the one opened moves to
 * the front with `now`.
 */
export function recordRecentThreadVisit(
  entries: readonly RecentThreadEntry[],
  previousKey: string | null,
  nextKey: string | null,
  now: number,
  cap = RECENT_THREADS_CAP,
): readonly RecentThreadEntry[] {
  const next: RecentThreadEntry[] = nextKey === null ? [] : [{ key: nextKey, at: now }];
  for (const entry of entries) {
    if (next.length >= cap) break;
    if (entry.key === nextKey) continue;
    next.push(entry.key === previousKey ? { key: entry.key, at: now } : entry);
  }
  return next;
}

function isSwitchable(thread: RecentThreadCandidate | null): boolean {
  return thread !== null && thread.archivedAt === null && thread.deletedAt === null;
}

/**
 * Drops archived and deleted threads, and threads left longer than `timeoutMs`
 * ago. The open thread and the switchable one before it always stay, so a tap
 * can always go back.
 */
export function expireRecentThreads(
  entries: readonly RecentThreadEntry[],
  currentKey: string | null,
  now: number,
  timeoutMs: number,
  lookup: (key: string) => RecentThreadCandidate | null,
): readonly RecentThreadEntry[] {
  let previousKept = false;
  const kept = entries.filter((entry) => {
    if (entry.key === currentKey) return true;
    const thread = lookup(entry.key);
    // Unknown threads may belong to an environment that has not loaded yet.
    if (thread !== null && !isSwitchable(thread)) return false;
    if (!previousKept && thread !== null) {
      previousKept = true;
      return true;
    }
    // A clock set back leaves `at` in the future; count that as just now.
    return timeoutMs <= 0 || now - Math.min(entry.at, now) <= timeoutMs;
  });
  return kept.length === entries.length ? entries : kept;
}

/**
 * The switcher's rows: recent threads that exist and are neither deleted nor
 * archived, with the open thread first.
 */
export function resolveRecentThreadList(
  entries: readonly RecentThreadEntry[],
  currentKey: string | null,
  lookup: (key: string) => RecentThreadCandidate | null,
): readonly string[] {
  const keys = currentKey === null ? [] : [currentKey];
  for (const entry of entries) {
    if (entry.key !== currentKey) keys.push(entry.key);
  }
  return keys.filter((key) => isSwitchable(lookup(key)));
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

export function readTimeoutMinutes(storage: StorageLike | null): number {
  try {
    const value = Number(storage?.getItem(RECENT_THREADS_TIMEOUT_STORAGE_KEY) || Number.NaN);
    return RECENT_THREADS_TIMEOUT_OPTIONS.some((option) => option === value)
      ? value
      : DEFAULT_RECENT_THREADS_TIMEOUT_MINUTES;
  } catch {
    return DEFAULT_RECENT_THREADS_TIMEOUT_MINUTES;
  }
}

export function writeTimeoutMinutes(storage: StorageLike | null, minutes: number): void {
  try {
    storage?.setItem(RECENT_THREADS_TIMEOUT_STORAGE_KEY, String(minutes));
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
